/**
 * A few names against a few names, in a file beside the backups (lab/calibre).
 * What Julian decided once — which work a book is, which books went to the
 * reader, which scan stands in for a collection's — is not asked again.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class FileMap {
  private readonly map: Record<string, string>;

  constructor(private readonly file: string) {
    this.map = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : {};
  }

  get(key: string | number): string | undefined {
    return this.map[String(key)];
  }

  all(): Record<string, string> {
    return { ...this.map };
  }

  set(key: string | number, value: string): void {
    this.map[String(key)] = value;
    this.save();
  }

  delete(key: string | number): void {
    if (!(String(key) in this.map)) return;
    delete this.map[String(key)];
    this.save();
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.map, null, 1));
    renameSync(`${this.file}.tmp`, this.file);
  }
}
