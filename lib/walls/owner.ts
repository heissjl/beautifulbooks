/**
 * Who owns a wall (ROADMAP 5.13a, decision E22). Server only: it hashes.
 *
 * As on taketest.xyz, a browser that makes its first wall gets a random
 * visitor id in the `bb_visitor` cookie, and the page shows the id so it can
 * be pasted on another device. N11 is lifted for this and only this (E22).
 * The store keeps the SHA-256 of the id on each wall, never the id itself:
 * a leaked store neither edits a wall nor says whose it is.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cleanTitle, DEFAULT_COLUMNS, isVisitorId, toPublic, type PublicWall, type Tile, type Wall } from './model';

export const VISITOR_COOKIE = 'bb_visitor';
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 730;

/** Ten characters from a 36-letter alphabet: ~51 bits, enough that ids are not walked in sequence. */
export function newWallId(bytes: Buffer = randomBytes(10)): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return [...bytes].map((b) => alphabet[b % 36]).join('');
}

/** A new visitor id: a version-4 UUID (122 random bits), written with hyphens. */
export function newVisitorId(bytes: Buffer = randomBytes(16)): string {
  const b = Buffer.from(bytes.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function hashVisitor(visitor: string): string {
  return createHash('sha256').update(visitor).digest('hex');
}

/** Constant-time check: does this visitor own the wall? */
export function isOwner(wall: Pick<Wall, 'ownerHash'>, visitor: unknown): boolean {
  if (!isVisitorId(visitor)) return false;
  const a = Buffer.from(hashVisitor(visitor), 'hex');
  const b = Buffer.from(wall.ownerHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newWall(id: string, visitor: string, title: string, now: string, tiles: Tile[] = []): Wall {
  return {
    id,
    ownerHash: hashVisitor(visitor),
    title: cleanTitle(title) || 'My collection',
    columns: DEFAULT_COLUMNS,
    tiles,
    unsaved: true,
    createdOn: now.slice(0, 10),
    updatedAt: now,
  };
}

/** The walls a visitor owns, newest change first — the "Your walls" row. */
export function ownedBy(walls: readonly Wall[], visitor: unknown): PublicWall[] {
  if (!isVisitorId(visitor)) return [];
  return walls
    .filter((w) => isOwner(w, visitor))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toPublic);
}
