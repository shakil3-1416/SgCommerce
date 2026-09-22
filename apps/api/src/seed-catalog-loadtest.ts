import 'reflect-metadata';

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

type VariantKind =
  | 'color'
  | 'size'
  | 'shoe'
  | 'single';

type CategoryConfig = {
  name: string;
  slug: string;
  description: string;
  count: number;
  code: string;
  brands: string[];
  adjectives: string[];
  nouns: string[];
  minPrice: number;
  maxPrice: number;
  variantKind: VariantKind;
  images: string[];
};

type SeedVariant = {
  sku: string;
  title: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  active: boolean;
};

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  categorySlug: string;
  brand: string;
  active: boolean;
  images: string[];
  variants: SeedVariant[];
};

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description:
      'Consumer electronics, audio devices and smart accessories.',
    count: 50,
    code: 'EL',
    brands: [
      'SgAudio',
      'NovaTech',
      'Voltix',
      'Auralink',
    ],
    adjectives: [
      'Wireless',
      'Smart',
      'Premium',
      'Compact',
      'Pro',
      'Everyday',
    ],
    nouns: [
      'Headphones',
      'Earbuds',
      'Bluetooth Speaker',
      'Smart Watch',
      'Portable Speaker',
      'Audio Receiver',
    ],
    minPrice: 1290,
    maxPrice: 14990,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Fashion',
    slug: 'fashion',
    description:
      'Everyday fashion, clothing and wardrobe essentials.',
    count: 50,
    code: 'FA',
    brands: [
      'SgBasics',
      'Threadline',
      'Urban Loom',
      'North & Main',
    ],
    adjectives: [
      'Classic',
      'Relaxed',
      'Essential',
      'Premium',
      'Everyday',
      'Urban',
    ],
    nouns: [
      'Cotton T-Shirt',
      'Polo Shirt',
      'Casual Shirt',
      'Hoodie',
      'Sweatshirt',
      'Chino Pants',
    ],
    minPrice: 650,
    maxPrice: 4990,
    variantKind: 'size',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    description:
      'Furniture, decor and practical products for the home.',
    count: 40,
    code: 'HL',
    brands: [
      'CasaNest',
      'SgHome',
      'Oak & Linen',
      'LivingLab',
    ],
    adjectives: [
      'Modern',
      'Soft',
      'Minimal',
      'Cozy',
      'Nordic',
      'Classic',
    ],
    nouns: [
      'Table Lamp',
      'Cushion Set',
      'Storage Basket',
      'Wall Shelf',
      'Bedside Organizer',
      'Decor Vase',
    ],
    minPrice: 550,
    maxPrice: 8990,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description:
      'Beauty, skincare and personal care essentials.',
    count: 30,
    code: 'BE',
    brands: [
      'PureGlow',
      'Velora',
      'SgCare',
      'BloomLab',
    ],
    adjectives: [
      'Hydrating',
      'Daily',
      'Gentle',
      'Radiance',
      'Nourishing',
      'Refreshing',
    ],
    nouns: [
      'Face Cleanser',
      'Body Lotion',
      'Hair Serum',
      'Skin Cream',
      'Beauty Set',
      'Face Mist',
    ],
    minPrice: 390,
    maxPrice: 3490,
    variantKind: 'single',
    images: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Sports & Outdoors',
    slug: 'sports-outdoors',
    description:
      'Fitness, training and outdoor activity products.',
    count: 30,
    code: 'SP',
    brands: [
      'PeakMotion',
      'SgSport',
      'ActiveCore',
      'TrailForm',
    ],
    adjectives: [
      'Performance',
      'Training',
      'Active',
      'Outdoor',
      'Flex',
      'Endurance',
    ],
    nouns: [
      'Yoga Mat',
      'Training Bottle',
      'Resistance Band Set',
      'Gym Bag',
      'Fitness Gloves',
      'Exercise Kit',
    ],
    minPrice: 450,
    maxPrice: 5990,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Computers & Accessories',
    slug: 'computers-accessories',
    description:
      'Computer peripherals, workspace devices and accessories.',
    count: 35,
    code: 'PC',
    brands: [
      'ByteForge',
      'SgCompute',
      'KeyNova',
      'PixelDesk',
    ],
    adjectives: [
      'Mechanical',
      'Wireless',
      'Precision',
      'Compact',
      'Pro',
      'Ergonomic',
    ],
    nouns: [
      'Keyboard',
      'Mouse',
      'Laptop Stand',
      'USB Hub',
      'Desk Pad',
      'Webcam',
    ],
    minPrice: 690,
    maxPrice: 9990,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Mobile Accessories',
    slug: 'mobile-accessories',
    description:
      'Chargers, cases, stands and everyday mobile accessories.',
    count: 30,
    code: 'MO',
    brands: [
      'SgMobile',
      'ChargeUp',
      'GripOne',
      'Voltix',
    ],
    adjectives: [
      'Fast',
      'Magnetic',
      'Slim',
      'Protective',
      'Portable',
      'Wireless',
    ],
    nouns: [
      'Phone Charger',
      'Phone Case',
      'Power Bank',
      'Charging Cable',
      'Phone Stand',
      'Car Mount',
    ],
    minPrice: 290,
    maxPrice: 4990,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Shoes',
    slug: 'shoes',
    description:
      'Casual, athletic and everyday footwear.',
    count: 30,
    code: 'SH',
    brands: [
      'StrideLab',
      'SgStep',
      'UrbanRun',
      'NorthWalk',
    ],
    adjectives: [
      'Classic',
      'Runner',
      'Street',
      'Comfort',
      'Active',
      'Everyday',
    ],
    nouns: [
      'Sneakers',
      'Running Shoes',
      'Walking Shoes',
      'Casual Trainers',
      'Canvas Shoes',
      'Lifestyle Shoes',
    ],
    minPrice: 1190,
    maxPrice: 6990,
    variantKind: 'shoe',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Bags & Accessories',
    slug: 'bags-accessories',
    description:
      'Bags, backpacks and practical everyday accessories.',
    count: 25,
    code: 'BA',
    brands: [
      'CarryCo',
      'SgCarry',
      'MetroPack',
      'Nomad Works',
    ],
    adjectives: [
      'Urban',
      'Classic',
      'Travel',
      'Compact',
      'Daily',
      'Premium',
    ],
    nouns: [
      'Backpack',
      'Crossbody Bag',
      'Laptop Bag',
      'Travel Pouch',
      'Shoulder Bag',
      'Day Pack',
    ],
    minPrice: 790,
    maxPrice: 6490,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Kitchen',
    slug: 'kitchen',
    description:
      'Kitchenware, preparation tools and cooking essentials.',
    count: 30,
    code: 'KI',
    brands: [
      'SgKitchen',
      'CookCraft',
      'DailyPantry',
      'HomeChef',
    ],
    adjectives: [
      'Essential',
      'Stainless',
      'Everyday',
      'Premium',
      'Compact',
      'Classic',
    ],
    nouns: [
      'Cookware Set',
      'Kitchen Knife',
      'Storage Container',
      'Serving Bowl',
      'Cutting Board',
      'Utensil Set',
    ],
    minPrice: 390,
    maxPrice: 7990,
    variantKind: 'single',
    images: [
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Office & Stationery',
    slug: 'office-stationery',
    description:
      'Office, study and stationery essentials.',
    count: 25,
    code: 'OF',
    brands: [
      'DeskLab',
      'SgOffice',
      'PaperNorth',
      'Workline',
    ],
    adjectives: [
      'Professional',
      'Daily',
      'Minimal',
      'Premium',
      'Smart',
      'Classic',
    ],
    nouns: [
      'Notebook Set',
      'Desk Organizer',
      'Pen Set',
      'Document Folder',
      'Desk Calendar',
      'Stationery Kit',
    ],
    minPrice: 190,
    maxPrice: 2490,
    variantKind: 'single',
    images: [
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    name: 'Kids',
    slug: 'kids',
    description:
      'Kids essentials, toys and activity products.',
    count: 25,
    code: 'KD',
    brands: [
      'LittleJoy',
      'SgKids',
      'PlayNest',
      'BrightSteps',
    ],
    adjectives: [
      'Creative',
      'Colorful',
      'Learning',
      'Playtime',
      'Adventure',
      'Little',
    ],
    nouns: [
      'Building Set',
      'Activity Kit',
      'Toy Set',
      'Learning Cards',
      'Kids Backpack',
      'Creative Set',
    ],
    minPrice: 350,
    maxPrice: 4490,
    variantKind: 'color',
    images: [
      'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560961911-ba7ef651a56c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1599443015574-be5fe8a05783?auto=format&fit=crop&w=1200&q=80',
    ],
  },
];

const SERIES = [
  'Core',
  'One',
  'Plus',
  'Edge',
  'Flex',
  'Air',
  'Prime',
  'Go',
  'Studio',
  'Metro',
];

function hashNumber(
  value: string,
): number {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);

    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return hash >>> 0;
}

function slugify(
  value: string,
): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function priceFor(
  config: CategoryConfig,
  index: number,
): number {
  const span =
    config.maxPrice -
    config.minPrice;

  const raw =
    config.minPrice +
    (
      hashNumber(
        `${config.slug}:${index}:price`,
      ) %
      (span + 1)
    );

  return Math.max(
    config.minPrice,
    Math.round(raw / 10) * 10,
  );
}

function productImages(
  config: CategoryConfig,
  index: number,
): string[] {
  const first =
    index %
    config.images.length;

  const second =
    (index + 1) %
    config.images.length;

  const third =
    (index + 2) %
    config.images.length;

  return index % 4 === 0
    ? [
        config.images[first],
        config.images[second],
        config.images[third],
      ]
    : [
        config.images[first],
        config.images[second],
      ];
}

function compareAtPrice(
  price: number,
  seed: string,
): number | undefined {
  if (
    hashNumber(seed) % 3 !== 0
  ) {
    return undefined;
  }

  return Math.ceil(
    price * 1.18 / 10,
  ) * 10;
}

function makeVariants(
  config: CategoryConfig,
  productIndex: number,
  price: number,
): SeedVariant[] {
  const root =
    `${config.code}-${String(
      productIndex + 1,
    ).padStart(3, '0')}`;

  const makeVariant = (
    suffix: string,
    title: string,
    attributes: Record<string, string>,
    priceAdjustment = 0,
  ): SeedVariant => {
    const variantPrice =
      price +
      priceAdjustment;

    return {
      sku: `${root}-${suffix}`,
      title,
      attributes,
      price: variantPrice,
      compareAtPrice:
        compareAtPrice(
          variantPrice,
          `${config.slug}:${productIndex}:${suffix}`,
        ),
      active: true,
    };
  };

  if (
    config.variantKind ===
    'size'
  ) {
    return [
      makeVariant(
        'M',
        'Medium',
        {
          size: 'M',
        },
      ),
      makeVariant(
        'L',
        'Large',
        {
          size: 'L',
        },
      ),
      makeVariant(
        'XL',
        'Extra Large',
        {
          size: 'XL',
        },
        100,
      ),
    ];
  }

  if (
    config.variantKind ===
    'shoe'
  ) {
    return [
      makeVariant(
        '40',
        'Size 40',
        {
          size: '40',
        },
      ),
      makeVariant(
        '41',
        'Size 41',
        {
          size: '41',
        },
      ),
      makeVariant(
        '42',
        'Size 42',
        {
          size: '42',
        },
      ),
    ];
  }

  if (
    config.variantKind ===
    'color'
  ) {
    return [
      makeVariant(
        'BLK',
        'Black',
        {
          color: 'Black',
        },
      ),
      makeVariant(
        'WHT',
        'White',
        {
          color: 'White',
        },
      ),
    ];
  }

  return [
    makeVariant(
      'STD',
      'Standard',
      {},
    ),
  ];
}

function makeClassicTshirt(
  config: CategoryConfig,
): SeedProduct {
  return {
    name:
      'Classic Cotton T-Shirt',
    slug:
      'classic-cotton-t-shirt',
    description:
      'Comfortable everyday cotton T-shirt with a soft breathable finish.',
    categorySlug:
      config.slug,
    brand:
      'SgBasics',
    active:
      true,
    images:
      productImages(
        config,
        0,
      ),
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
  };
}

function makeWirelessHeadphones(
  config: CategoryConfig,
): SeedProduct {
  return {
    name:
      'Wireless Headphones',
    slug:
      'wireless-headphones',
    description:
      'Bluetooth wireless headphones with charging case and everyday listening comfort.',
    categorySlug:
      config.slug,
    brand:
      'SgAudio',
    active:
      true,
    images:
      productImages(
        config,
        0,
      ),
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
  };
}

function makeGenericProduct(
  config: CategoryConfig,
  index: number,
): SeedProduct {
  const adjective =
    config.adjectives[
      index %
      config.adjectives.length
    ];

  const noun =
    config.nouns[
      (
        index +
        Math.floor(
          index /
          config.adjectives.length,
        )
      ) %
      config.nouns.length
    ];

  const series =
    SERIES[
      index %
      SERIES.length
    ];

  const model =
    String(
      index + 1,
    ).padStart(
      2,
      '0',
    );

  const name =
    `${adjective} ${noun} ${series} ${model}`;

  const brand =
    config.brands[
      index %
      config.brands.length
    ];

  const price =
    priceFor(
      config,
      index,
    );

  return {
    name,
    slug:
      slugify(
        `${config.slug}-${name}`,
      ),
    description:
      `${name} by ${brand}. A dependable ${config.name.toLowerCase()} product designed for everyday SgCommerce customers.`,
    categorySlug:
      config.slug,
    brand,
    active:
      true,
    images:
      productImages(
        config,
        index,
      ),
    variants:
      makeVariants(
        config,
        index,
        price,
      ),
  };
}

function buildProducts():
  SeedProduct[] {
  const products:
    SeedProduct[] = [];

  for (
    const config
    of CATEGORY_CONFIGS
  ) {
    for (
      let index = 0;
      index < config.count;
      index += 1
    ) {
      if (
        config.slug ===
          'fashion' &&
        index === 0
      ) {
        products.push(
          makeClassicTshirt(
            config,
          ),
        );

        continue;
      }

      if (
        config.slug ===
          'electronics' &&
        index === 0
      ) {
        products.push(
          makeWirelessHeadphones(
            config,
          ),
        );

        continue;
      }

      products.push(
        makeGenericProduct(
          config,
          index,
        ),
      );
    }
  }

  if (
    products.length !==
    400
  ) {
    throw new Error(
      `Catalog generator produced ${products.length} products instead of 400`,
    );
  }

  const slugs =
    new Set(
      products.map(
        (product) =>
          product.slug,
      ),
    );

  if (
    slugs.size !==
    products.length
  ) {
    throw new Error(
      'Catalog generator produced duplicate product slugs',
    );
  }

  const skus =
    products.flatMap(
      (product) =>
        product.variants.map(
          (variant) =>
            variant.sku,
        ),
    );

  if (
    new Set(
      skus,
    ).size !==
    skus.length
  ) {
    throw new Error(
      'Catalog generator produced duplicate variant SKUs',
    );
  }

  return products;
}

async function seedCatalog() {
  await mongoose.connect(
    uri,
  );

  const CategoryModel =
    mongoose.models[
      Category.name
    ] ??
    mongoose.model(
      Category.name,
      CategorySchema,
    );

  const ProductModel =
    mongoose.models[
      Product.name
    ] ??
    mongoose.model(
      Product.name,
      ProductSchema,
    );

  const InventoryModel =
    mongoose.models[
      Inventory.name
    ] ??
    mongoose.model(
      Inventory.name,
      InventorySchema,
    );

  for (
    const config
    of CATEGORY_CONFIGS
  ) {
    await CategoryModel.updateOne(
      {
        slug:
          config.slug,
      },
      {
        $set: {
          name:
            config.name,
          slug:
            config.slug,
          description:
            config.description,
          active:
            true,
        },
      },
      {
        upsert: true,
      },
    );
  }

  const categoryDocuments =
    await CategoryModel
      .find({
        slug: {
          $in:
            CATEGORY_CONFIGS.map(
              (config) =>
                config.slug,
            ),
        },
      })
      .lean();

  const categoryIds =
    new Map<
      string,
      Types.ObjectId
    >();

  for (
    const category
    of categoryDocuments
  ) {
    categoryIds.set(
      category.slug,
      category._id as Types.ObjectId,
    );
  }

  const products =
    buildProducts();

  for (
    const product
    of products
  ) {
    const categoryId =
      categoryIds.get(
        product.categorySlug,
      );

    if (!categoryId) {
      throw new Error(
        `Missing category ${product.categorySlug}`,
      );
    }

    await ProductModel.updateOne(
      {
        slug:
          product.slug,
      },
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
          active:
            product.active,
          images:
            product.images,
          variants:
            product.variants,
        },
      },
      {
        upsert: true,
      },
    );
  }

  const seededDocuments =
    await ProductModel
      .find({
        slug: {
          $in:
            products.map(
              (product) =>
                product.slug,
            ),
        },
      })
      .lean();

  const productBySlug =
    new Map<
      string,
      {
        _id:
          Types.ObjectId;
        name:
          string;
      }
    >();

  for (
    const product
    of seededDocuments
  ) {
    productBySlug.set(
      product.slug,
      {
        _id:
          product._id as Types.ObjectId,
        name:
          product.name,
      },
    );
  }

  let inventorySeedCount = 0;

  for (
    const product
    of products
  ) {
    const stored =
      productBySlug.get(
        product.slug,
      );

    if (!stored) {
      throw new Error(
        `Seeded product ${product.slug} could not be reloaded`,
      );
    }

    for (
      const variant
      of product.variants
    ) {
      inventorySeedCount += 1;

      const hash =
        hashNumber(
          variant.sku,
        );

      const onHand =
        8 +
        (
          hash %
          53
        );

      const reorderLevel =
        4 +
        (
          hash %
          7
        );

      await InventoryModel.updateOne(
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
            onHand,
            reserved:
              0,
            reorderLevel,
          },
        },
        {
          upsert: true,
        },
      );
    }
  }

  const seededSlugs =
    products.map(
      (product) =>
        product.slug,
    );

  const seededProductIds =
    seededDocuments.map(
      (product) =>
        product._id,
    );

  const [
    categoryCount,
    productCount,
    imageProductCount,
    inventoryCount,
    totalActiveProducts,
  ] =
    await Promise.all([
      CategoryModel.countDocuments({
        slug: {
          $in:
            CATEGORY_CONFIGS.map(
              (config) =>
                config.slug,
            ),
        },
      }),

      ProductModel.countDocuments({
        slug: {
          $in:
            seededSlugs,
        },
      }),

      ProductModel.countDocuments({
        slug: {
          $in:
            seededSlugs,
        },
        'images.0': {
          $exists: true,
        },
      }),

      InventoryModel.countDocuments({
        productId: {
          $in:
            seededProductIds,
        },
      }),

      ProductModel.countDocuments({
        active: true,
      }),
    ]);

  console.log('');
  console.log(
    '==============================================',
  );
  console.log(
    ' SgCommerce scalable catalog seed complete',
  );
  console.log(
    '==============================================',
  );
  console.log(
    ` Categories seeded:          ${categoryCount}`,
  );
  console.log(
    ` Catalog products seeded:    ${productCount}`,
  );
  console.log(
    ` Products with images:       ${imageProductCount}`,
  );
  console.log(
    ` Inventory SKUs seeded:      ${inventoryCount}`,
  );
  console.log(
    ` Generated inventory seeds:  ${inventorySeedCount}`,
  );
  console.log(
    ` Total active products DB:   ${totalActiveProducts}`,
  );
  console.log(
    '==============================================',
  );
  console.log('');
  console.log(
    'Image URLs are demo catalog imagery.',
  );
  console.log(
    'Replace them with merchant or supplier-owned production assets before public launch.',
  );

  await mongoose.disconnect();
}

seedCatalog().catch(
  async (error) => {
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
