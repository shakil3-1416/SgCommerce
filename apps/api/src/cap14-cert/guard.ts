/**
 * Fail-closed target check for the CAP-14 certification seed.
 *
 * The seed may only ever write to a database whose name contains
 * `cap14_cert` (for example `sgcommerce_cap14_cert`). Production-looking names
 * are refused even if they contain the marker. The check runs on the URI
 * before connecting AND on the connected database before any write.
 */

export const REQUIRED_MARKER = 'cap14_cert';
const FORBIDDEN_WORDS = ['prod', 'live', 'main'];

export class Cap14TargetRefused extends Error {
  constructor(reason: string) {
    super(`CAP-14 seed refused: ${reason}`);
    this.name = 'Cap14TargetRefused';
  }
}

/** The database name in a MongoDB URI's path ('' when none is given). */
export function databaseNameFromUri(uri: string): string {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri.trim());
  return match ? decodeURIComponent(match[1]).trim() : '';
}

export function assertCap14Database(name: string): string {
  const database = (name ?? '').trim();
  if (!database) {
    throw new Cap14TargetRefused('the MongoDB URI names no database (the driver default is never acceptable)');
  }
  const lowered = database.toLowerCase();
  if (!lowered.includes(REQUIRED_MARKER)) {
    throw new Cap14TargetRefused(`database "${database}" does not contain "${REQUIRED_MARKER}"`);
  }
  const forbidden = FORBIDDEN_WORDS.find((word) => lowered.split(/[^a-z0-9]+/).includes(word)
    || lowered.startsWith(word));
  if (forbidden) {
    throw new Cap14TargetRefused(`database "${database}" looks like a production database ("${forbidden}")`);
  }
  return database;
}
