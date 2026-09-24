import 'reflect-metadata';

import { readFile } from 'node:fs/promises';

import {
  writeFile,
} from 'node:fs/promises';

import mongoose, {
  Types,
} from 'mongoose';

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

const usdToBdt =
  Number(
    process.env.DEMO_USD_TO_BDT ??
      '120',
  );

type CatalogProduct = {
  source:
    | 'dummyjson'
    | 'fakestore'
    | 'curated';

  externalId: string;

  name: string;
  slug: string;

  description: string;

  categorySlug: string;
  categoryName: string;

  brand: string;

  images: string[];

  price: number;

  compareAtPrice?:
    number;

  sku: string;

  stock: number;

  variants?: {
    sku: string;
    title: string;

    attributes:
      Record<
        string,
        string
      >;

    price: number;

    active: boolean;
  }[];
};

type DummyJsonProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage?: number;
  stock?: number;
  brand?: string;
  sku?: string;
  thumbnail?: string;
  images?: string[];
};

type DummyJsonResponse = {
  products:
    DummyJsonProduct[];

  total: number;
};

type FakeStoreProduct = {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
};

const LEGACY_CATEGORY_SLUGS = [
  'electronics',
  'fashion',
  'home-living',
  'beauty-personal-care',
  'sports-outdoors',
  'computers-accessories',
  'mobile-accessories',
  'shoes',
  'bags-accessories',
  'kitchen',
  'office-stationery',
  'kids',
];

function slugify(
  value: string,
): string {
  return value
    .toLowerCase()
    .trim()
    .replace(
      /&/g,
      ' and ',
    )
    .replace(
      /[^a-z0-9]+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    );
}

function titleCase(
  value: string,
): string {
  return value
    .split('-')
    .map(
      (part) =>
        part
          ? part[0]
              .toUpperCase() +
            part.slice(1)
          : part,
    )
    .join(' ');
}

function bdt(
  usd: number,
): number {
  return Math.max(
    50,
    Math.round(
      (
        usd *
        usdToBdt
      ) /
        10,
    ) * 10,
  );
}

function uniqueHttpsImages(
  values:
    (
      | string
      | undefined
      | null
    )[],
): string[] {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value?.trim() ??
            '',
        )
        .filter(
          (value) =>
            value.startsWith(
              'https://',
            ),
        ),
    ),
  );
}

async function readCatalogSnapshot<T>(
  relativePath: string,
): Promise<T> {
  const body =
    await readFile(
      `${process.cwd()}/${relativePath}`,
      'utf8',
    );

  return JSON.parse(
    body,
  ) as T;
}

function curatedProducts():
  CatalogProduct[] {
  return [
    {
      source:
        'curated',

      externalId:
        'sg-classic-cotton-tshirt',

      name:
        'Classic Cotton T-Shirt',

      slug:
        'classic-cotton-t-shirt',

      description:
        'Soft everyday cotton T-shirt with a comfortable regular fit and breathable construction.',

      categorySlug:
        'mens-shirts',

      categoryName:
        "Men's Shirts",

      brand:
        'SgBasics',

      images:
        uniqueHttpsImages([
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85',
          '/catalog/classic-cotton-t-shirt.svg',
        ]),

      price:
        950,

      sku:
        'TS-BLK-M',

      stock:
        37,

      variants: [
        {
          sku:
            'TS-BLK-M',

          title:
            'Black / M',

          attributes: {
            color:
              'Black',

            size:
              'M',
          },

          price:
            950,

          active:
            true,
        },
        {
          sku:
            'TS-BLK-L',

          title:
            'Black / L',

          attributes: {
            color:
              'Black',

            size:
              'L',
          },

          price:
            950,

          active:
            true,
        },
        {
          sku:
            'TS-BLK-XL',

          title:
            'Black / XL',

          attributes: {
            color:
              'Black',

            size:
              'XL',
          },

          price:
            950,

          active:
            true,
        },
      ],
    },

    {
      source:
        'curated',

      externalId:
        'sg-wireless-headphones',

      name:
        'Wireless Headphones',

      slug:
        'wireless-headphones',

      description:
        'Comfortable over-ear Bluetooth headphones designed for wireless everyday listening.',

      categorySlug:
        'mobile-accessories',

      categoryName:
        'Mobile Accessories',

      brand:
        'SgAudio',

      images:
        uniqueHttpsImages([
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85',
          'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=85',
        ]),

      price:
        2490,

      sku:
        'WH-BLK-001',

      stock:
        24,

      variants: [
        {
          sku:
            'WH-BLK-001',

          title:
            'Black',

          attributes: {
            color:
              'Black',
          },

          price:
            2490,

          active:
            true,
        },
        {
          sku:
            'WH-WHT-001',

          title:
            'White',

          attributes: {
            color:
              'White',
          },

          price:
            2490,

          active:
            true,
        },
      ],
    },
  ];
}

function fromDummyJson(
  product:
    DummyJsonProduct,
): CatalogProduct {
  const sourcePrice =
    bdt(
      product.price,
    );

  const discount =
    product
      .discountPercentage ??
    0;

  const compareAtPrice =
    discount > 0 &&
    discount < 90
      ? Math.round(
          (
            sourcePrice /
            (
              1 -
              discount /
                100
            )
          ) /
            10,
        ) * 10
      : undefined;

  const categorySlug =
    slugify(
      product.category,
    );

  const images =
    uniqueHttpsImages([
      product.thumbnail,
      ...(product.images ??
        []),
    ]);

  return {
    source:
      'dummyjson',

    externalId:
      String(
        product.id,
      ),

    name:
      product.title,

    slug:
      `dj-${product.id}-${slugify(
        product.title,
      )}`,

    description:
      product.description,

    categorySlug,

    categoryName:
      titleCase(
        categorySlug,
      ),

    brand:
      product.brand?.trim() ||
      'Marketplace',

    images,

    price:
      sourcePrice,

    compareAtPrice,

    sku:
      `DJ-${String(
        product.id,
      ).padStart(
        4,
        '0',
      )}-STD`,

    stock:
      Math.max(
        0,
        Math.min(
          product.stock ??
            20,
          500,
        ),
      ),
  };
}

function fromFakeStore(
  product:
    FakeStoreProduct,
): CatalogProduct {
  const categorySlug =
    slugify(
      product.category,
    );

  return {
    source:
      'fakestore',

    externalId:
      String(
        product.id,
      ),

    name:
      product.title,

    slug:
      `fs-${product.id}-${slugify(
        product.title,
      )}`,

    description:
      product.description,

    categorySlug,

    categoryName:
      titleCase(
        categorySlug,
      ),

    brand:
      'Marketplace',

    images:
      uniqueHttpsImages([
        product.image,
      ]),

    price:
      bdt(
        product.price,
      ),

    sku:
      `FS-${String(
        product.id,
      ).padStart(
        4,
        '0',
      )}-STD`,

    stock:
      15 +
      (
        product.id %
        36
      ),
  };
}

async function main() {
  if (
    !Number.isFinite(
      usdToBdt,
    ) ||
    usdToBdt <= 0
  ) {
    throw new Error(
      'DEMO_USD_TO_BDT must be a positive number',
    );
  }

  console.log(
    'Loading bundled product catalog snapshots...',
  );

  const [
    dummy,
    fake,
  ] =
    await Promise.all([
      readCatalogSnapshot<DummyJsonResponse>(
        'src/catalog-snapshots/dummyjson-products.json',
      ),

      readCatalogSnapshot<
        FakeStoreProduct[]
      >(
        'src/catalog-snapshots/fakestore-products.json',
      ),
    ]);

  if (
    dummy.products.length <
    190
  ) {
    throw new Error(
      `DummyJSON returned only ${dummy.products.length} products`,
    );
  }

  if (
    fake.length <
    20
  ) {
    throw new Error(
      `Fake Store returned only ${fake.length} products`,
    );
  }

  const products = [
    ...curatedProducts(),
    ...dummy.products.map(
      fromDummyJson,
    ),
    ...fake.map(
      fromFakeStore,
    ),
  ];

  if (
    products.length <
      200 ||
    products.length >
      600
  ) {
    throw new Error(
      `Customer catalog size ${products.length} is outside the required 200-600 range`,
    );
  }

  const missingImages =
    products.filter(
      (product) =>
        product.images.length ===
        0,
    );

  if (
    missingImages.length
  ) {
    throw new Error(
      `${missingImages.length} imported products have no HTTPS image`,
    );
  }

  const primaryImages =
    products.map(
      (product) =>
        product.images[0],
    );

  const uniquePrimaryImages =
    new Set(
      primaryImages,
    );

  if (
    uniquePrimaryImages.size !==
    products.length
  ) {
    const counts =
      new Map<
        string,
        number
      >();

    for (
      const image
      of primaryImages
    ) {
      counts.set(
        image,
        (
          counts.get(
            image,
          ) ??
          0
        ) + 1,
      );
    }

    const duplicates =
      Array.from(
        counts.entries(),
      )
        .filter(
          (
            [
              ,
              count,
            ],
          ) =>
            count > 1,
        )
        .map(
          (
            [
              image,
              count,
            ],
          ) =>
            `${count}x ${image}`,
        );

    throw new Error(
      `Duplicate primary product images detected:\n${duplicates.join(
        '\n',
      )}`,
    );
  }

  await mongoose.connect(
    uri,
  );

  const CategoryModel =
    (
      mongoose.models[
        Category.name
      ] ??
      mongoose.model(
        Category.name,
        CategorySchema,
      )
    ) as mongoose.Model<any>;

  const ProductModel =
    (
      mongoose.models[
        Product.name
      ] ??
      mongoose.model(
        Product.name,
        ProductSchema,
      )
    ) as mongoose.Model<any>;

  const InventoryModel =
    (
      mongoose.models[
        Inventory.name
      ] ??
      mongoose.model(
        Inventory.name,
        InventorySchema,
      )
    ) as mongoose.Model<any>;

  const activeBefore =
    await ProductModel
      .find({
        active: true,
      })
      .lean();

  const categoriesBefore =
    await CategoryModel
      .find({})
      .lean();

  await writeFile(
    '/tmp/sgcommerce-catalog-backup.json',
    JSON.stringify(
      {
        exportedAt:
          new Date()
            .toISOString(),

        products:
          activeBefore,

        categories:
          categoriesBefore,
      },
      null,
      2,
    ),
    'utf8',
  );

  const managedBefore =
    await ProductModel
      .countDocuments({
        catalogSource: {
          $in: [
            'loadtest',
            'dummyjson',
            'fakestore',
            'curated',
          ],
        },
      });

  const totalProductsBefore =
    await ProductModel
      .countDocuments({});

  const inventoryBefore =
    await InventoryModel
      .countDocuments({});

  const isPristineCatalog =
    managedBefore === 0 &&
    totalProductsBefore === 0 &&
    activeBefore.length === 0 &&
    categoriesBefore.length === 0 &&
    inventoryBefore === 0;

  const isLegacyLoadTestCatalog =
    managedBefore === 0 &&
    activeBefore.length === 400;

  if (
    managedBefore === 0 &&
    !isPristineCatalog &&
    !isLegacyLoadTestCatalog
  ) {
    throw new Error(
      `Safety stop: expected either a pristine database or the current 400-product load-test catalog. Found ${totalProductsBefore} total products, ${activeBefore.length} active products, ${categoriesBefore.length} categories, and ${inventoryBefore} inventory rows instead`,
    );
  }

  if (
    isLegacyLoadTestCatalog
  ) {
    const oldIds =
      activeBefore.map(
        (
          product:
            any,
        ) =>
          product._id,
      );

    await ProductModel
      .updateMany(
        {
          _id: {
            $in:
              oldIds,
          },
        },
        {
          $set: {
            active:
              false,

            catalogSource:
              'loadtest',
          },

          $unset: {
            externalId:
              '',
          },
        },
      );

    await InventoryModel
      .deleteMany({
        productId: {
          $in:
            oldIds,
        },
      });

    console.log(
      `Retired ${oldIds.length} synthetic load-test products from the customer catalog.`,
    );
  } else if (
    isPristineCatalog
  ) {
    console.log(
      'Initializing professional catalog in a pristine database.',
    );
  }

  await ProductModel
    .updateMany(
      {
        catalogSource:
          'loadtest',
      },
      {
        $set: {
          active:
            false,
        },
      },
    );

  await ProductModel
    .updateMany(
      {
        catalogSource: {
          $in: [
            'dummyjson',
            'fakestore',
            'curated',
          ],
        },
      },
      {
        $set: {
          active:
            false,
        },
      },
    );

  await CategoryModel
    .updateMany(
      {
        slug: {
          $in:
            LEGACY_CATEGORY_SLUGS,
        },
      },
      {
        $set: {
          active:
            false,
        },
      },
    );

  const categoryMap =
    new Map<
      string,
      Types.ObjectId
    >();

  const uniqueCategories =
    Array.from(
      new Map(
        products.map(
          (product) => [
            product.categorySlug,
            {
              slug:
                product.categorySlug,

              name:
                product.categoryName,
            },
          ],
        ),
      ).values(),
    );

  for (
    const category
    of uniqueCategories
  ) {
    const document =
      await CategoryModel
        .findOneAndUpdate(
          {
            slug:
              category.slug,
          },
          {
            $set: {
              name:
                category.name,

              slug:
                category.slug,

              description:
                `${category.name} products in the SgCommerce customer catalog.`,

              active:
                true,
            },
          },
          {
            upsert:
              true,

            new:
              true,
          },
        );

    if (!document) {
      throw new Error(
        `Category ${category.slug} could not be created`,
      );
    }

    categoryMap.set(
      category.slug,
      document._id as Types.ObjectId,
    );
  }

  const importedIds:
    Types.ObjectId[] =
    [];

  const activeSkus =
    new Set<
      string
    >();

  for (
    const product
    of products
  ) {
    const categoryId =
      categoryMap.get(
        product.categorySlug,
      );

    if (
      !categoryId
    ) {
      throw new Error(
        `Category missing for ${product.slug}`,
      );
    }

    const variants =
      product.variants ??
      [
        {
          sku:
            product.sku,

          title:
            'Standard',

          attributes:
            {},

          price:
            product.price,

          active:
            true,
        },
      ];

    const query =
      product.source ===
      'curated'
        ? {
            slug:
              product.slug,
          }
        : {
            catalogSource:
              product.source,

            externalId:
              product.externalId,
          };

    const stored =
      await ProductModel
        .findOneAndUpdate(
          query,
          {
            $set: {
              name:
                product.name,

              slug:
                product.slug,

              description:
                product.description,

              category:
                categoryId,

              brand:
                product.brand,

              images:
                product.images,

              variants:
                variants.map(
                  (
                    variant,
                  ) => ({
                    ...variant,

                    compareAtPrice:
                      variant.price ===
                        product.price
                        ? product
                            .compareAtPrice
                        : undefined,
                  }),
                ),

              active:
                true,

              catalogSource:
                product.source,

              externalId:
                product.externalId,
            },
          },
          {
            upsert:
              true,

            new:
              true,
          },
        );

    if (!stored) {
      throw new Error(
        `Product ${product.slug} could not be imported`,
      );
    }

    importedIds.push(
      stored._id as Types.ObjectId,
    );

    for (
      const [
        index,
        variant,
      ]
      of variants.entries()
    ) {
      activeSkus.add(
        variant.sku,
      );

      const variantStock =
        Math.max(
          1,
          product.stock -
            index * 3,
        );

      await InventoryModel
        .updateOne(
          {
            sku:
              variant.sku,
          },
          {
            $set: {
              sku:
                variant.sku,

              productId:
                stored._id,

              productName:
                stored.name,

              variantTitle:
                variant.title,

              onHand:
                variantStock,

              reserved:
                0,

              reorderLevel:
                Math.max(
                  3,
                  Math.min(
                    10,
                    Math.floor(
                      variantStock /
                        4,
                    ),
                  ),
                ),
            },
          },
          {
            upsert:
              true,
          },
        );
    }
  }

  await InventoryModel
    .deleteMany({
      productId: {
        $in:
          importedIds,
      },

      sku: {
        $nin:
          Array.from(
            activeSkus,
          ),
      },
    });

  const activeProducts =
    await ProductModel
      .find({
        active: true,
      })
      .lean();

  const customerProducts =
    activeProducts.filter(
      (
        product:
          any,
      ) =>
        [
          'dummyjson',
          'fakestore',
          'curated',
        ].includes(
          product.catalogSource,
        ),
    );

  const withImages =
    customerProducts.filter(
      (
        product:
          any,
      ) =>
        Array.isArray(
          product.images,
        ) &&
        product.images.length >
          0,
    );

  const uniqueCovers =
    new Set(
      withImages.map(
        (
          product:
            any,
        ) =>
          product.images[0],
      ),
    );

  const inventoryCount =
    await InventoryModel
      .countDocuments({
        productId: {
          $in:
            importedIds,
        },
      });

  console.log('');
  console.log(
    '==============================================',
  );
  console.log(
    ' SgCommerce customer catalog imported',
  );
  console.log(
    '==============================================',
  );
  console.log(
    ` DummyJSON products:         ${dummy.products.length}`,
  );
  console.log(
    ` Fake Store products:        ${fake.length}`,
  );
  console.log(
    ` Curated SgCommerce:          2`,
  );
  console.log(
    ` Customer products:          ${customerProducts.length}`,
  );
  console.log(
    ` Products with images:       ${withImages.length}`,
  );
  console.log(
    ` Unique cover images:        ${uniqueCovers.size}`,
  );
  console.log(
    ` Active inventory SKUs:      ${inventoryCount}`,
  );
  console.log(
    ` Active categories:          ${uniqueCategories.length}`,
  );
  console.log(
    '==============================================',
  );

  if (
    customerProducts.length !==
    products.length
  ) {
    throw new Error(
      `Expected ${products.length} imported products, found ${customerProducts.length}`,
    );
  }

  if (
    withImages.length !==
    customerProducts.length
  ) {
    throw new Error(
      'Not every customer product has an image',
    );
  }

  if (
    uniqueCovers.size !==
    customerProducts.length
  ) {
    throw new Error(
      'Customer products do not have unique cover images',
    );
  }

  await mongoose.disconnect();
}

main().catch(
  async (
    error,
  ) => {
    console.error(
      error,
    );

    await mongoose
      .disconnect()
      .catch(
        () =>
          undefined,
      );

    process.exit(1);
  },
);
