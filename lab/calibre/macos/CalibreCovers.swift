// Calibre Covers — the window around lab/calibre/app.ts (ROADMAP 5.16b).
//
// Julian, 2026-10-03: „wrap it as a local macos app?" — decided as a window of
// its own. This file is the whole app: it starts the tool's local server
// (`npx tsx lab/calibre/app.ts --write --port auto --exit-with-parent`) in the
// project folder written into Info.plist by build.sh, waits for the address
// the server prints, and shows it in a web view. The server ends with the app:
// it watches the pipe this process holds, so a quit, a crash and a force quit
// all take it down.
//
// Nothing here knows about covers or Calibre; every rule and every guard is in
// the TypeScript beside it. Built with `lab/calibre/macos/build.sh`, unsigned
// but for an ad-hoc signature — it is meant for this Mac only.

import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var web: WKWebView!
    private var server: Process?
    private let stdinPipe = Pipe()
    private var output = ""
    private var address: URL?
    private let env = ProcessInfo.processInfo.environment

    private func setting(_ key: String, env name: String) -> String {
        if let value = env[name], !value.isEmpty { return value }
        return (Bundle.main.object(forInfoDictionaryKey: key) as? String) ?? ""
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        let config = WKWebViewConfiguration()
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Calibre Covers"
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("CalibreCoversMain")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        show(message: "Starting…", detail: "")
        startServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        // Closing our end of the pipe is what the server waits for; terminate() is the second hand.
        try? stdinPipe.fileHandleForWriting.close()
        server?.terminate()
    }

    // MARK: the server

    private func startServer() {
        let project = setting("CalibreProjectDir", env: "CALIBRE_APP_DIR")
        let nodeBin = setting("CalibreNodeBin", env: "CALIBRE_NODE_BIN")
        guard FileManager.default.fileExists(atPath: project + "/lab/calibre/app.ts") else {
            show(message: "The project folder is not where this app was built for.",
                 detail: "Expected lab/calibre/app.ts in:\n\(project)\n\nBuild the app again from the project: lab/calibre/macos/build.sh")
            return
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // The folder and node's place travel as environment, not as text in the command: the path has spaces in it.
        process.arguments = ["-lc", "export PATH=\"$CALIBRE_NODE_BIN:$PATH\"; cd \"$CALIBRE_APP_DIR\" && exec npx tsx lab/calibre/app.ts --write --port auto --exit-with-parent"]
        var environment = env
        environment["CALIBRE_APP_DIR"] = project
        environment["CALIBRE_NODE_BIN"] = nodeBin
        process.environment = environment
        process.standardInput = stdinPipe
        let out = Pipe()
        process.standardOutput = out
        process.standardError = out
        out.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async { self?.heard(text) }
        }
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.show(message: self.address == nil ? "The tool did not start." : "The tool has stopped.", detail: self.output)
            }
        }
        do {
            try process.run()
            server = process
        } catch {
            show(message: "The tool could not be started.", detail: error.localizedDescription)
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
            guard let self = self, self.address == nil, self.server?.isRunning == true else { return }
            self.show(message: "Still starting…", detail: self.output)
        }
    }

    private func heard(_ text: String) {
        output += text
        if output.count > 20_000 { output = String(output.suffix(20_000)) }
        guard address == nil,
              let range = output.range(of: #"http://127\.0\.0\.1:\d+/\?t=[A-Za-z0-9_-]+"#, options: .regularExpression),
              let url = URL(string: String(output[range])) else { return }
        address = url
        web.load(URLRequest(url: url))
    }

    private func show(message: String, detail: String) {
        let escape = { (s: String) in s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;") }
        // The address carries the run's token; it is never shown.
        let shown = detail.replacingOccurrences(of: #"\?t=[A-Za-z0-9_-]+"#, with: "?t=…", options: .regularExpression)
        web.loadHTMLString("""
            <meta charset="utf-8"><body style="font: 15px -apple-system; padding: 48px; color: #555; background: #f6f3ee">
            <p style="font-size: 18px; color: #1d1b19">\(escape(message))</p>
            <pre style="white-space: pre-wrap; font: 12px ui-monospace, Menlo, monospace">\(escape(shown))</pre></body>
            """, baseURL: nil)
    }

    // MARK: the web view

    private func isOurs(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        return url.scheme == "about" || (url.host == "127.0.0.1" && url.port == address?.port)
    }

    /// The window shows the tool and nothing else: any other address opens in the browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.targetFrame?.isMainFrame == true, !isOurs(action.request.url), let url = action.request.url {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    /// A link that asks for a new window („Open on buyitscovers.com") goes to the browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    /// With CALIBRE_APP_SELFCHECK set, the app says on standard error what the page shows — how build.sh's check knows the window works.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let check = env["CALIBRE_APP_SELFCHECK"], isOurs(webView.url), webView.url?.host != nil else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            webView.evaluateJavaScript("document.querySelectorAll('.book').length + ' books; ' + document.getElementById('mode').textContent + '; ' + document.getElementById('stats').textContent") { result, error in
                FileHandle.standardError.write("selfcheck: \(result ?? error?.localizedDescription ?? "nothing")\n".data(using: .utf8)!)
                if check == "quit" { NSApp.terminate(nil) }
            }
        }
    }

    @objc private func reload() {
        if let url = address { web.load(URLRequest(url: url)) }
    }

    // MARK: the menu — without an Edit menu, ⌘C and ⌘V do nothing in a text field

    private func buildMenu() {
        let main = NSMenu()
        func add(_ title: String, _ items: [NSMenuItem]) {
            let item = NSMenuItem()
            let menu = NSMenu(title: title)
            items.forEach(menu.addItem)
            item.submenu = menu
            main.addItem(item)
        }
        func item(_ title: String, _ action: Selector?, _ key: String, target: AnyObject? = nil) -> NSMenuItem {
            let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
            i.target = target
            return i
        }
        add("Calibre Covers", [
            item("Hide Calibre Covers", #selector(NSApplication.hide(_:)), "h"),
            .separator(),
            item("Quit Calibre Covers", #selector(NSApplication.terminate(_:)), "q"),
        ])
        add("Edit", [
            item("Undo", Selector(("undo:")), "z"), item("Redo", Selector(("redo:")), "Z"), .separator(),
            item("Cut", #selector(NSText.cut(_:)), "x"), item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Paste", #selector(NSText.paste(_:)), "v"), item("Select All", #selector(NSText.selectAll(_:)), "a"),
        ])
        add("View", [item("Reload", #selector(reload), "r", target: self)])
        add("Window", [
            item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Close", #selector(NSWindow.performClose(_:)), "w"),
        ])
        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
