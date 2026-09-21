import 'reflect-metadata';

import mongoose from 'mongoose';

import {
  Category,
  CategorySchema,
} from './modules/catalog/schemas/category.schema';

import {
  Product,
  ProductSchema,
} from './modules/catalog/schemas/product.schema';

import {
  Inventory,
  InventorySchema,
} from './modules/inventory/schemas/inventory.schema';

const uri =
  process.env.MONGODB_URI ??
  'mongodb://localhost:27017/sgcommerce';

async function seed() {
  await mongoose.connect(uri);

  const CategoryModel =
    mongoose.models[Category.name] ??
    mongoose.model(
      Category.name,
      CategorySchema,
    );

  const ProductModel =
    mongoose.models[Product.name] ??
    mongoose.model(
      Product.name,
      ProductSchema,
    );

  const InventoryModel =
    mongoose.models[Inventory.name] ??
    mongoose.model(
      Inventory.name,
      InventorySchema,
    );

  const categorySeeds = [
    {
      name: 'Fashion',
      slug: 'fashion',
      description:
        'Clothing and fashion products',
      active: true,
    },
    {
      name: 'Electronics',
      slug: 'electronics',
      description:
        'Electronics and accessories',
      active: true,
    },
    {
      name: 'Home & Living',
      slug: 'home-living',
      description:
        'Home and lifestyle products',
      active: true,
    },
  ];

  for (const category of categorySeeds) {
    await CategoryModel.updateOne(
      {
        slug: category.slug,
      },
      {
        $set: category,
      },
      {
        upsert: true,
      },
    );
  }

  const fashion =
    await CategoryModel.findOne({
      slug: 'fashion',
    }).lean();

  const electronics =
    await CategoryModel.findOne({
      slug: 'electronics',
    }).lean();

  if (!fashion || !electronics) {
    throw new Error(
      'Seed categories could not be created',
    );
  }

  const products = [
    {
      name: 'Classic Cotton T-Shirt',
      slug: 'classic-cotton-t-shirt',
      description:
        'Comfortable everyday cotton T-shirt.',
      category: fashion._id,
      brand: 'SgBasics',
      active: true,
      images: [],
      variants: [
        {
          sku: 'TS-BLK-M',
          title: 'Black / M',
          attributes: {
            color: 'Black',
            size: 'M',
          },
          price: 950,
          active: true,
        },
        {
          sku: 'TS-BLK-L',
          title: 'Black / L',
          attributes: {
            color: 'Black',
            size: 'L',
          },
          price: 950,
          active: true,
        },
        {
          sku: 'TS-BLK-XL',
          title: 'Black / XL',
          attributes: {
            color: 'Black',
            size: 'XL',
          },
          price: 950,
          active: true,
        },
      ],
    },

    {
      name: 'Wireless Headphones',
      slug: 'wireless-headphones',
      description:
        'Bluetooth wireless headphones with charging case.',
      category: electronics._id,
      brand: 'SgAudio',
      active: true,
      images: [],
      variants: [
        {
          sku: 'WH-BLK-001',
          title: 'Black',
          attributes: {
            color: 'Black',
          },
          price: 2490,
          active: true,
        },
        {
          sku: 'WH-WHT-001',
          title: 'White',
          attributes: {
            color: 'White',
          },
          price: 2490,
          active: true,
        },
      ],
    },
  ];

  for (const product of products) {
    await ProductModel.updateOne(
      {
        slug: product.slug,
      },
      {
        $set: product,
      },
      {
        upsert: true,
      },
    );
  }

  const inventorySeeds = [
    {
      sku: 'TS-BLK-M',
      onHand: 18,
      reserved: 0,
      reorderLevel: 5,
    },
    {
      sku: 'TS-BLK-L',
      onHand: 12,
      reserved: 0,
      reorderLevel: 5,
    },
    {
      sku: 'TS-BLK-XL',
      onHand: 7,
      reserved: 0,
      reorderLevel: 5,
    },
    {
      sku: 'WH-BLK-001',
      onHand: 14,
      reserved: 0,
      reorderLevel: 4,
    },
    {
      sku: 'WH-WHT-001',
      onHand: 3,
      reserved: 0,
      reorderLevel: 4,
    },
  ];

  for (const entry of inventorySeeds) {
    const product =
      await ProductModel.findOne({
        'variants.sku': entry.sku,
      }).lean();

    if (!product) {
      continue;
    }

    const variant =
      product.variants.find(
        (item: any) =>
          item.sku === entry.sku,
      );

    if (!variant) {
      continue;
    }

    await InventoryModel.updateOne(
      {
        sku: entry.sku,
      },
      {
        $set: {
          ...entry,
          productId:
            product._id,
          productName:
            product.name,
          variantTitle:
            variant.title,
        },
      },
      {
        upsert: true,
      },
    );
  }

  const counts = {
    categories:
      await CategoryModel.countDocuments(),
    products:
      await ProductModel.countDocuments(),
    inventory:
      await InventoryModel.countDocuments(),
  };

  console.log(
    'SgCommerce seed complete:',
    counts,
  );

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);

  await mongoose
    .disconnect()
    .catch(() => undefined);

  process.exit(1);
});
