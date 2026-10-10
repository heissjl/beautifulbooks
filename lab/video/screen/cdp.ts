/**
 * A small DevTools-protocol client for headless Chrome (ROADMAP 5.5b).
 *
 * The browser pane of the desktop app drops input while it is hidden, so the
 * clip is recorded in a headless Chrome of its own, driven over the protocol:
 * one page, a phone viewport, commands and events. No dependency beyond Node's
 * own WebSocket (Node 22).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

type Params = Record<string, unknown>;
type Waiter = { resolve: (v: Params) => void; reject: (e: Error) => void };

export interface Page {
  send(method: string, params?: Params): Promise<Params>;
  /** Resolves with the next event of this name. */
  once(event: string): Promise<Params>;
  /** Calls back on every event of this name until the returned function is called. */
  on(event: string, callback: (p: Params) => void): () => void;
  /** Evaluates an expression in the page and returns its value. */
  evaluate<T = unknown>(expression: string): Promise<T>;
  close(): Promise<void>;
}

async function wsUrl(port: number): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Chrome did not start');
}

/**
 * `headed: true` opens a real window, placed off screen: a headless Chrome is
 * turned away by bookshop.org's bot check ("Sorry, you have been blocked",
 * 2026-10-09), a headed one with a fresh profile is let in.
 */
export async function launch(port = 9333, headed = false): Promise<Page> {
  const profile = mkdtempSync(join(tmpdir(), 'bb-clip-'));
  const chrome: ChildProcess = spawn(CHROME, [
    ...(headed ? ['--window-position=-3000,0', '--window-size=400,700'] : ['--headless=new', '--hide-scrollbars']),
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--force-color-profile=srgb', 'about:blank',
  ], { stdio: 'ignore' });
  const ws = new WebSocket(await wsUrl(port));
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('no connection to Chrome'));
  });
  let id = 0;
  const pending = new Map<number, Waiter>();
  const listeners = new Map<string, ((p: Params) => void)[]>();
  const steady = new Map<string, Set<(p: Params) => void>>();
  ws.onmessage = (msg) => {
    const data = JSON.parse(String(msg.data)) as { id?: number; result?: Params; error?: { message: string }; method?: string; params?: Params };
    if (data.id !== undefined) {
      const w = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) w?.reject(new Error(data.error.message));
      else w?.resolve(data.result ?? {});
    } else if (data.method) {
      const ls = listeners.get(data.method) ?? [];
      listeners.delete(data.method);
      for (const l of ls) l(data.params ?? {});
      for (const l of steady.get(data.method) ?? []) l(data.params ?? {});
    }
  };
  const send = (method: string, params: Params = {}): Promise<Params> =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const once = (event: string): Promise<Params> =>
    new Promise(resolve => listeners.set(event, [...(listeners.get(event) ?? []), resolve]));
  const evaluate = async <T>(expression: string): Promise<T> => {
    const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })) as {
      result: { value?: T }; exceptionDetails?: { text: string; exception?: { description?: string } };
    };
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  const on = (event: string, callback: (p: Params) => void): (() => void) => {
    const set = steady.get(event) ?? new Set();
    set.add(callback);
    steady.set(event, set);
    return () => set.delete(callback);
  };
  return {
    send, once, on, evaluate,
    close: async () => {
      ws.close();
      chrome.kill();
    },
  };
}
