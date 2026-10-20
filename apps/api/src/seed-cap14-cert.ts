/**
 * CAP-14 certification seed (SupGent live capability certification).
 *
 *   MONGODB_URI=mongodb+srv://…/sgcommerce_cap14_cert pnpm --filter api seed:cap14-cert [--reset]
 *   pnpm --filter api cap14:manifest [path]      # no database needed
 *
 * Refuses (before connecting and again before any write) unless the database
 * name contains "cap14_cert". There is no default URI. --reset first deletes
 * ONLY CAP14-CERT-* fixtures. Prints counts, never the URI or credentials.
 */
import { writeFileSync } from 'node:fs';

import mongoose from 'mongoose';

import { buildCap14Fixtures } from './cap14-cert/fixtures';
import { assertCap14Database, Cap14TargetRefused, databaseNameFromUri } from './cap14-cert/guard';
import { buildCap14Manifest } from './cap14-cert/manifest';
import { seedCap14 } from './cap14-cert/seed';

function writeManifest(path: string | undefined): void {
  const json = `${JSON.stringify(buildCap14Manifest(buildCap14Fixtures()), null, 2)}\n`;
  if (path) {
    writeFileSync(path, json, 'utf8');
    console.log(`CAP-14 manifest written to ${path}`);
  } else {
    process.stdout.write(json);
  }
}

async function seed(reset: boolean): Promise<void> {
  const uri = (process.env.MONGODB_URI ?? '').trim();
  if (!uri) {
    throw new Cap14TargetRefused('MONGODB_URI is required (there is no default target)');
  }
  assertCap14Database(databaseNameFromUri(uri));
  const connection = await mongoose.createConnection(uri, { autoIndex: true }).asPromise();
  try {
    const result = await seedCap14(connection, buildCap14Fixtures(), { now: new Date(), reset });
    console.log(JSON.stringify({ seeded: 'cap14-cert', ...result }, null, 2));
  } finally {
    await connection.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === 'manifest') {
    writeManifest(args[1]);
    return;
  }
  await seed(args.includes('--reset'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'CAP-14 seed failed');
  process.exitCode = 1;
});
