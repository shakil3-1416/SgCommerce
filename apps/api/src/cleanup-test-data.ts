import {
  NestFactory,
} from '@nestjs/core';

import {
  getConnectionToken,
} from '@nestjs/mongoose';

import type {
  Connection,
} from 'mongoose';

import {
  AppModule,
} from './app.module';

async function main() {
  const app =
    await NestFactory
      .createApplicationContext(
        AppModule,
        {
          logger: false,
        },
      );

  try {
    const connection =
      app.get<Connection>(
        getConnectionToken(),
      );

    const db =
      connection.db;

    if (!db) {
      throw new Error(
        'MongoDB connection unavailable',
      );
    }

    const orders =
      db.collection('orders');

    const returns =
      db.collection('returns');

    const refunds =
      db.collection('refunds');

    const products =
      db.collection('products');

    const categories =
      db.collection('categories');

    const users =
      db.collection('users');

    const customers =
      db.collection('customers');

    const testOrders =
      await orders
        .find({
          $or: [
            {
              'customer.email':
                'e2e@example.com',
            },
            {
              'customer.email':
                'idempotency@example.com',
            },
            {
              'items.sku':
                'E2E-SMOKE-001',
            },
          ],
        })
        .project({
          orderNumber: 1,
        })
        .toArray();

    const orderNumbers =
      testOrders
        .map(
          (item) =>
            item.orderNumber,
        )
        .filter(Boolean);

    if (
      orderNumbers.length > 0
    ) {
      await refunds.deleteMany({
        orderNumber: {
          $in:
            orderNumbers,
        },
      });

      await returns.deleteMany({
        orderNumber: {
          $in:
            orderNumbers,
        },
      });

      await orders.deleteMany({
        orderNumber: {
          $in:
            orderNumbers,
        },
      });
    }

    await products.deleteMany({
      slug:
        'e2e-smoke-product',
    });

    await categories.deleteMany({
      slug:
        'e2e-smoke',
    });

    const automatedEmail = {
      $or: [
        {
          email: {
            $regex:
              '^customer-[0-9]+@example\\.com$',
          },
        },
        {
          email: {
            $regex:
              '^browser-[0-9]+@example\\.com$',
          },
        },
        {
          email:
            'e2e@example.com',
        },
        {
          email:
            'idempotency@example.com',
        },
      ],
    };

    await users.deleteMany(
      automatedEmail,
    );

    await customers.deleteMany(
      automatedEmail,
    );

    /*
     * Delete E2E-SMOKE-001 records from inventory
     * and movement collections without relying on
     * collection naming conventions.
     */
    const collections =
      await db.collections();

    for (
      const collection
      of collections
    ) {
      await collection.deleteMany({
        sku:
          'E2E-SMOKE-001',
      });
    }

    /*
     * Restore the seeded shirt quantity modified
     * by the idempotency smoke test.
     */
    for (
      const collection
      of collections
    ) {
      const stock =
        await collection.findOne({
          sku:
            'TS-BLK-M',
          onHand: {
            $exists: true,
          },
        });

      if (stock) {
        await collection.updateOne(
          {
            _id:
              stock._id,
          },
          {
            $set: {
              onHand: 18,
              reserved: 0,
              reorderLevel: 5,
            },
          },
        );
      }
    }

    console.log(
      'Automated test data cleaned',
    );
  } finally {
    await app.close();
  }
}

void main();
