/**
 * Gives every existing product a product code and prepares the counters.
 *
 * What it does:
 *   1. Numbers products that have no `productCode`, oldest first.
 *   2. Creates the unique index on `productCode`.
 *   3. Sets each counter so that new records continue after existing ones
 *      (new orders start at SGO-0001001 rather than at 1).
 *   4. Rewrites stored Bangladesh mobile numbers in one format,
 *      01XXXXXXXXX, on customers, users, orders, returns and refunds, so
 *      a customer is recognised however the number was typed. A customer
 *      who was saved twice (typed once with +880 and once with 0) is
 *      merged into one record: the orders and saved addresses of the
 *      duplicate move to the record that is kept.
 *
 * It does not touch slugs, SKUs, or the numbers of existing orders,
 * returns and refunds. Inventory rows, stock movements and past orders
 * refer to those, so they stay as they are; only records created from now
 * on use the new formats.
 *
 * Dry run, changes nothing (default):
 *   pnpm --filter api exec tsx src/backfill-business-ids.ts
 *
 * Apply:
 *   pnpm --filter api exec tsx src/backfill-business-ids.ts --apply
 *
 * Like the seed scripts, it uses MONGODB_URI and falls back to the local
 * development database. To run it against production, put the production
 * connection string in front of the command:
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter api exec tsx src/backfill-business-ids.ts
 *
 * It prints the server and database it is connected to before doing
 * anything, and it is safe to run more than once: coded products are
 * skipped and counters only ever move forward.
 *
 * Run it again after `seed:catalog`, because the import scripts write
 * products directly and do not give them codes.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import mongoose from 'mongoose';

import {
  formatCode,
  planCodeBackfill,
  type SequenceName,
} from './modules/sequences/business-ids';
import { maskPhone, planCustomerPhones, planPhoneUpdates } from './common/phone';

/*
 * Collection names follow Mongoose's default pluralisation of the model
 * names. The script stops if `products` is missing, so a wrong name cannot
 * silently create an empty collection.
 */
const PRODUCTS = 'products';
const CODE_FIELD = 'productCode';
const COUNTERS = 'counters';
const INDEX_NAME = 'productCode_unique';

/**
 * Where each counter starts when it does not exist yet: at the number of
 * records already in the collection, or at `floor` if that is higher, so
 * that the first new order is not "number 1".
 */
const COUNTER_SOURCES: Record<
  Exclude<SequenceName, 'product'>,
  { collection: string; floor: number }
> = {
  order: { collection: 'orders', floor: 1000 },
  return: { collection: 'returns', floor: 0 },
  refund: { collection: 'refunds', floor: 0 },
};

/*
 * Every place a phone number is stored, apart from the customers
 * themselves, which cleanCustomerPhones() handles because a customer who
 * was saved twice has to be merged. Users are matched by phone, so there
 * the number must stay unique.
 */
const PHONE_FIELDS: Array<{ collection: string; field: string; unique: boolean }> = [
  { collection: 'users', field: 'phone', unique: true },
  { collection: 'orders', field: 'customer.phone', unique: false },
  { collection: 'returns', field: 'customerPhone', unique: false },
  { collection: 'refunds', field: 'customerPhone', unique: false },
];

/** Reads "customer.phone" from { customer: { phone } }. */
function readPath(doc: Record<string, unknown>, path: string): unknown {
  let value: unknown = doc;

  for (const part of path.split('.')) {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }

    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

interface CounterDoc {
  _id: string;
  seq: number;
}

function log(message = ''): void {
  console.log(message);
}

/** Host part of a connection string, without the user name and password. */
function describeServer(uri: string): string {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri);

  return match?.[1] ?? '(unrecognised connection string)';
}

type Database = NonNullable<typeof mongoose.connection.db>;

/**
 * Customers are identified by phone. This rewrites their numbers in the
 * stored format and, where one customer was saved twice (once typed with
 * +880, once with 0), merges the two records: the orders and saved
 * addresses of the duplicate move to the record that is kept, then the
 * duplicate is removed.
 *
 * Each step is safe to repeat, so a run that is interrupted can simply be
 * started again. Before anything is removed, the records involved are
 * written to a file in the temporary folder.
 */
async function cleanCustomerPhones(
  db: Database,
  collectionNames: Set<string>,
  apply: boolean,
): Promise<void> {
  const customers = db.collection('customers');

  const docs = await customers
    .find({}, { projection: { _id: 1, phone: 1, addresses: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  // Customer records that a user account (a sign-in) points at.
  const withAccount = new Set<string>();

  if (collectionNames.has('users')) {
    const users = await db
      .collection('users')
      .find({}, { projection: { customerId: 1 } })
      .toArray();

    for (const user of users) {
      if (user.customerId) {
        withAccount.add(String(user.customerId));
      }
    }
  }

  const plan = planCustomerPhones(
    docs.map((doc) => ({
      id: String(doc._id),
      phone: doc.phone,
      hasAccount: withAccount.has(String(doc._id)),
    })),
  );

  log(
    `  ${'customers'.padEnd(10)} ${String(docs.length).padStart(6)} checked, ` +
      `${plan.rewrites.length} to rewrite, ${plan.merges.length} saved twice (to merge), ` +
      `${plan.blocked.length} left alone`,
  );

  for (const change of plan.rewrites.slice(0, 3)) {
    log(`      ${maskPhone(change.from)} -> ${maskPhone(change.to)}`);
  }

  for (const blocked of plan.blocked) {
    log(
      `      NOT changed: ${blocked.ids.join(', ')} share ${maskPhone(blocked.phone)} ` +
        'and more than one of them has its own account',
    );
  }

  const hasOrders = collectionNames.has('orders');
  const orders = db.collection('orders');

  // Work out, for every merge, exactly what will move.
  const merges = [];

  for (const merge of plan.merges) {
    const keep = byId.get(merge.keepId);
    const removed = merge.removeIds.flatMap((id) => byId.get(id) ?? []);

    if (!keep) {
      continue;
    }

    const removedIds = removed.map((doc) => doc._id);

    const ordersToMove = hasOrders
      ? await orders
          .find(
            { customerId: { $in: removedIds } },
            { projection: { _id: 1, orderNumber: 1, customerId: 1 } },
          )
          .toArray()
      : [];

    const keptAddresses: Array<{ id?: unknown }> = Array.isArray(keep.addresses)
      ? keep.addresses
      : [];
    const knownAddressIds = new Set(keptAddresses.map((address) => String(address.id)));

    const addressesToCopy = removed
      .flatMap((doc): Array<{ id?: unknown }> => (Array.isArray(doc.addresses) ? doc.addresses : []))
      .filter((address) => !knownAddressIds.has(String(address.id)))
      // A customer has one default address; the kept record's own choice stands.
      .map((address) => ({ ...address, isDefault: false }));

    const reason = withAccount.has(merge.keepId)
      ? 'it has an account'
      : merge.keepPhone === merge.phone
        ? 'it is already in the stored format'
        : 'it is the oldest';

    log(
      `      MERGE ${maskPhone(merge.phone)}: keep ${merge.keepId} (${reason}), ` +
        `move ${ordersToMove.length} order(s) and ${addressesToCopy.length} saved address(es) ` +
        `from ${merge.removeIds.join(', ')}, then remove the duplicate`,
    );

    merges.push({ merge, keep, removedIds, ordersToMove, keptAddresses, addressesToCopy });
  }

  if (!apply) {
    return;
  }

  if (plan.rewrites.length > 0) {
    const result = await customers.bulkWrite(
      plan.rewrites.map((change) => ({
        updateOne: {
          // Only rewrites a record that still holds the value the plan was made from.
          filter: { _id: byId.get(change.id)?._id, phone: change.from },
          update: { $set: { phone: change.to } },
        },
      })),
      { ordered: false },
    );

    log(`      rewrote ${result.modifiedCount} of ${plan.rewrites.length}`);
  }

  if (merges.length === 0) {
    return;
  }

  // Keep a copy of everything that is about to be removed or re-pointed.
  const backupFile = join(
    tmpdir(),
    `sgcommerce-customer-merge-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );

  const removedInFull = await customers
    .find({ _id: { $in: merges.flatMap((item) => item.removedIds) } })
    .toArray();

  writeFileSync(
    backupFile,
    JSON.stringify(
      {
        database: db.databaseName,
        createdAt: new Date().toISOString(),
        removedCustomers: removedInFull,
        merges: merges.map((item) => ({
          phone: item.merge.phone,
          keptCustomer: item.merge.keepId,
          removedCustomers: item.merge.removeIds,
          movedOrders: item.ordersToMove,
        })),
      },
      null,
      2,
    ),
  );

  log(`      copy of the removed records saved to ${backupFile}`);

  for (const item of merges) {
    // 1. Orders of the duplicate now belong to the record that is kept.
    if (hasOrders && item.ordersToMove.length > 0) {
      await orders.updateMany(
        { customerId: { $in: item.removedIds } },
        { $set: { customerId: item.keep._id } },
      );
    }

    // 2. Saved addresses the kept record does not have yet.
    if (item.addressesToCopy.length > 0) {
      await customers.updateOne(
        { _id: item.keep._id },
        { $set: { addresses: [...item.keptAddresses, ...item.addressesToCopy] } },
      );
    }

    // 3. The duplicate goes. It has to go before step 4, because two
    //    customers cannot hold the same number.
    await customers.deleteMany({ _id: { $in: item.removedIds } });

    // 4. The kept record gets the number in the stored format.
    if (item.merge.keepPhone !== item.merge.phone) {
      await customers.updateOne({ _id: item.keep._id }, { $set: { phone: item.merge.phone } });
    }
  }

  log(`      merged ${merges.length}`);
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  // `||` rather than `??`: a variable that is present but empty counts as not set.
  const uri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/sgcommerce';

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('MongoDB connection is not ready.');
  }

  log(`Server:   ${describeServer(uri)}`);
  log(`Database: ${db.databaseName}`);
  log(apply ? 'Mode:     APPLY' : 'Mode:     dry run (add --apply to write)');
  log();

  const collectionNames = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name,
    ),
  );

  if (!collectionNames.has(PRODUCTS)) {
    throw new Error(
      `Collection "${PRODUCTS}" was not found in database "${db.databaseName}". ` +
        `Collections found: ${[...collectionNames].sort().join(', ') || '(none)'}. ` +
        'Check that MONGODB_URI names the right database.',
    );
  }


  const counters = db.collection<CounterDoc>(COUNTERS);
  const products = db.collection(PRODUCTS);

  const existing = await products
    .find({}, { projection: { _id: 1, [CODE_FIELD]: 1, name: 1, createdAt: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const byId = new Map(existing.map((product) => [String(product._id), product]));
  const productCounter = await counters.findOne({ _id: 'product' });

  const plan = planCodeBackfill(
    'product',
    existing.map((product) => {
      const value: unknown = product[CODE_FIELD];

      return {
        id: String(product._id),
        code: value === undefined || value === null ? null : String(value),
      };
    }),
    productCounter?.seq ?? 0,
  );

  log(`Products: ${existing.length}`);
  log(`  already coded:   ${plan.alreadyCoded}`);
  log(`  to be coded:     ${plan.assignments.length}`);
  log(`  not recognised:  ${plan.unrecognised.length} (left alone)`);

  for (const id of plan.unrecognised.slice(0, 10)) {
    log(`    ${id}  ${CODE_FIELD}=${JSON.stringify(byId.get(id)?.[CODE_FIELD])}`);
  }

  const preview = plan.assignments.slice(0, 5);

  if (preview.length > 0) {
    log();
    log('First assignments:');

    for (const { id, code } of preview) {
      log(`  ${code}  ${String(byId.get(id)?.name ?? id)}`);
    }

    const last = plan.assignments.at(-1);

    if (last && plan.assignments.length > preview.length) {
      log(`  ... ${plan.assignments.length - preview.length} more, ending at ${last.code}`);
    }
  }

  if (apply && plan.assignments.length > 0) {
    const result = await products.bulkWrite(
      plan.assignments.map(({ id, code }) => ({
        updateOne: {
          /*
           * `$in: [null, '']` matches a missing, null or empty field, so a
           * product that received a code since the plan was made is skipped
           * rather than overwritten.
           */
          filter: { _id: byId.get(id)?._id, [CODE_FIELD]: { $in: [null, ''] } },
          update: { $set: { [CODE_FIELD]: code } },
        },
      })),
      { ordered: true },
    );

    log();
    log(`Coded ${result.modifiedCount} of ${plan.assignments.length} products.`);

    if (result.modifiedCount !== plan.assignments.length) {
      log('Some products changed while the script ran. Run it again to finish.');
    }
  }

  if (apply) {
    /*
     * Partial, so a product saved without a code (for example by an old
     * code path) does not collide with another one on `null`. Declare the
     * same index in product.schema.ts; see the README.
     */
    await products.createIndex(
      { [CODE_FIELD]: 1 },
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: { [CODE_FIELD]: { $type: 'string' } },
      },
    );

    log(`Index ${INDEX_NAME} is in place.`);
  }

  log();
  log('Counters:');

  const targets: Array<{ name: SequenceName; value: number }> = [
    { name: 'product', value: plan.lastValue },
  ];

  for (const [name, source] of Object.entries(COUNTER_SOURCES) as Array<
    [Exclude<SequenceName, 'product'>, { collection: string; floor: number }]
  >) {
    const count = collectionNames.has(source.collection)
      ? await db.collection(source.collection).countDocuments({})
      : 0;

    targets.push({ name, value: Math.max(count, source.floor) });
  }

  for (const { name, value } of targets) {
    const before = name === 'product' ? productCounter : await counters.findOne({ _id: name });
    const after = Math.max(before?.seq ?? 0, value);

    if (apply) {
      // $max only ever raises the value, so a counter already in use is safe.
      await counters.updateOne({ _id: name }, { $max: { seq: value } }, { upsert: true });
    }

    log(
      `  ${name.padEnd(9)} ${String(before?.seq ?? '(new)').padStart(7)} -> ${String(after).padStart(7)}   next: ${formatCode(name, after + 1)}`,
    );
  }

  log();
  log('Phone numbers (stored as 01XXXXXXXXX):');

  if (collectionNames.has('customers')) {
    await cleanCustomerPhones(db, collectionNames, apply);
  } else {
    log(`  ${'customers'.padEnd(10)} (no such collection yet)`);
  }

  for (const { collection, field, unique } of PHONE_FIELDS) {
    if (!collectionNames.has(collection)) {
      log(`  ${collection.padEnd(10)} (no such collection yet)`);
      continue;
    }

    const docs = await db
      .collection(collection)
      .find({}, { projection: { _id: 1, [field]: 1 } })
      .toArray();

    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

    const phonePlan = planPhoneUpdates(
      docs.map((doc) => ({ id: String(doc._id), phone: readPath(doc, field) })),
      unique,
    );

    log(
      `  ${collection.padEnd(10)} ${String(docs.length).padStart(6)} checked, ` +
        `${phonePlan.updates.length} to rewrite, ${phonePlan.conflicts.length} left alone`,
    );

    for (const change of phonePlan.updates.slice(0, 3)) {
      log(`      ${maskPhone(change.from)} -> ${maskPhone(change.to)}`);
    }

    for (const conflict of phonePlan.conflicts) {
      log(
        `      NOT changed: ${conflict.id} has ${maskPhone(conflict.from)}, but another record already uses ${maskPhone(conflict.to)}`,
      );
    }

    if (apply && phonePlan.updates.length > 0) {
      const result = await db.collection(collection).bulkWrite(
        phonePlan.updates.map((change) => ({
          updateOne: {
            // Only rewrites a record that still holds the value the plan was made from.
            filter: { _id: byId.get(change.id)?._id, [field]: change.from },
            update: { $set: { [field]: change.to } },
          },
        })),
        { ordered: false },
      );

      log(`      rewrote ${result.modifiedCount} of ${phonePlan.updates.length}`);
    }
  }

  log();
  log(apply ? 'Done.' : 'Dry run finished. Nothing was changed.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
