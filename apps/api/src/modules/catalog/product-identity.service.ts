import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  FilterQuery,
  Model,
  Types,
} from 'mongoose';

import {
  assignVariantSkus,
  lastVariantPosition,
  parseCode,
  slugify,
  typedSkus,
  type VariantSkuInput,
} from '../sequences/business-ids';

import {
  SequencesService,
} from '../sequences/sequences.service';

import {
  Product,
  ProductDocument,
} from './schemas/product.schema';

export interface ProductIdentityInput {
  name: string;
  /** Optional. When blank, the slug is derived from the name. */
  slug?: string | null;
  /** One entry per variant, in form order. A blank `sku` is generated. */
  variants: readonly VariantSkuInput[];
}

export interface VariantSkus {
  /** One SKU per variant, in the same order as the input. */
  skus: string[];
  /**
   * Highest variant number this product has ever used. Stored on the
   * product so the SKU of a deleted variant is never issued again.
   */
  lastVariantNumber: number;
}

export interface ProductIdentity extends VariantSkus {
  /** For example "SGP-000217". Stored on the product and never changed. */
  productCode: string;
  slug: string;
}

export interface VariantCompletionInput {
  productId: string | Types.ObjectId;
  productCode: string;
  /** Every variant the product will have after the edit, in form order. */
  variants: readonly VariantSkuInput[];
  /** `lastVariantNumber` as stored on the product. */
  lastVariantNumber?: number | null;
  /** The SKUs the product has right now, before the edit is applied. */
  currentSkus?: readonly string[];
}

/**
 * Gives a product its identity so staff never have to type one: a product
 * code from the `product` sequence, a unique slug, and a SKU for every
 * variant whose SKU was left blank.
 *
 * Everything that can be rejected is checked before a number is taken, so
 * a validation error does not use up a product code. The unique indexes on
 * `productCode`, `slug` and `variants.sku` remain the final guard against
 * two saves that happen in the same instant.
 */
@Injectable()
export class ProductIdentityService {
  constructor(
    private readonly sequences: SequencesService,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  /** Identity for a product that is being created. */
  async assign(
    input: ProductIdentityInput,
  ): Promise<ProductIdentity> {
    const name =
      typeof input.name === 'string'
        ? input.name.trim()
        : '';

    if (name === '') {
      throw new BadRequestException(
        'Product name is required',
      );
    }

    const typed =
      this.validateTypedSkus(input.variants);

    await this.assertSkusAreFree(typed);

    const requestedSlug =
      typeof input.slug === 'string'
        ? slugify(input.slug)
        : '';

    if (
      requestedSlug !== '' &&
      (await this.slugExists(requestedSlug))
    ) {
      throw new ConflictException(
        `Product slug "${requestedSlug}" already exists`,
      );
    }

    const productCode =
      await this.sequences.nextCode('product');

    const slug =
      requestedSlug !== ''
        ? requestedSlug
        : await this.derivedSlug(
            name,
            productCode,
          );

    const skus =
      assignVariantSkus(
        productCode,
        input.variants,
      );

    return {
      productCode,
      slug,
      skus,
      lastVariantNumber:
        lastVariantPosition(productCode, skus),
    };
  }

  /**
   * SKUs for an existing product whose variants were edited. Typed SKUs
   * are kept; blank ones are generated after the highest number this
   * product has ever used.
   */
  async completeVariantSkus(
    input: VariantCompletionInput,
  ): Promise<VariantSkus> {
    const typed =
      this.validateTypedSkus(input.variants);

    await this.assertSkusAreFree(
      typed,
      input.productId,
    );

    const stored = input.lastVariantNumber;

    const lastIssued =
      typeof stored === 'number' &&
      Number.isSafeInteger(stored) &&
      stored > 0
        ? stored
        : 0;

    const currentSkus =
      input.currentSkus ?? [];

    const skus =
      assignVariantSkus(
        input.productCode,
        input.variants,
        currentSkus,
        lastIssued,
      );

    return {
      skus,
      lastVariantNumber: Math.max(
        lastIssued,
        lastVariantPosition(
          input.productCode,
          [...currentSkus, ...skus],
        ),
      ),
    };
  }

  /**
   * Returns the product's code, issuing one first if the product was
   * created before product codes existed and the backfill script has not
   * reached it yet.
   */
  async ensureProductCode(product: {
    _id: Types.ObjectId;
    productCode?: string | null;
  }): Promise<string> {
    if (
      typeof product.productCode === 'string' &&
      product.productCode !== ''
    ) {
      return product.productCode;
    }

    const code =
      await this.sequences.nextCode('product');

    /*
     * Native driver call on purpose. `productCode` is immutable in the
     * schema, so Mongoose would drop it from an update. The filter only
     * matches a product that still has no code, so two requests cannot
     * both write one.
     */
    await this.productModel.collection.updateOne(
      {
        _id: product._id,
        productCode: {
          $in: [null, ''],
        },
      },
      {
        $set: {
          productCode: code,
        },
      },
    );

    const stored =
      await this.productModel
        .findById(product._id)
        .select({
          productCode: 1,
        })
        .lean();

    if (!stored?.productCode) {
      throw new NotFoundException(
        'Product not found',
      );
    }

    return stored.productCode;
  }

  /**
   * A slug typed by staff, normalised and checked. Throws when it is
   * empty after normalising or when another product already uses it.
   */
  async typedSlug(
    raw: string,
    ownProductId?: string | Types.ObjectId,
  ): Promise<string> {
    const slug = slugify(raw);

    if (slug === '') {
      throw new BadRequestException(
        'Product slug cannot be empty',
      );
    }

    if (await this.slugExists(slug, ownProductId)) {
      throw new ConflictException(
        `Product slug "${slug}" already exists`,
      );
    }

    return slug;
  }

  private validateTypedSkus(
    variants: readonly VariantSkuInput[],
  ): string[] {
    try {
      return typedSkus(variants).filter(
        (sku): sku is string => sku !== null,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Invalid SKU',
      );
    }
  }

  private async assertSkusAreFree(
    skus: readonly string[],
    ownProductId?: string | Types.ObjectId,
  ): Promise<void> {
    if (skus.length === 0) {
      return;
    }

    const filter: FilterQuery<ProductDocument> = {
      'variants.sku': {
        $in: skus,
      },
    };

    if (ownProductId) {
      filter._id = {
        $ne: ownProductId,
      };
    }

    const clashes =
      await this.productModel
        .find(filter)
        .select({
          'variants.sku': 1,
        })
        .lean();

    if (clashes.length === 0) {
      return;
    }

    const existing = new Set<string>();

    for (const product of clashes) {
      for (const variant of product.variants ?? []) {
        if (typeof variant.sku === 'string') {
          existing.add(variant.sku);
        }
      }
    }

    const inUse =
      skus.filter((sku) => existing.has(sku));

    throw new ConflictException(
      `SKU ${inUse.join(', ')} is already used by another product. Change it, or leave the field blank to have one generated.`,
    );
  }

  private async slugExists(
    slug: string,
    ownProductId?: string | Types.ObjectId,
  ): Promise<boolean> {
    const found =
      await this.productModel.exists(
        ownProductId
          ? {
              _id: {
                $ne: ownProductId,
              },
              slug,
            }
          : {
              slug,
            },
      );

    return found !== null;
  }

  /**
   * Slug from the product name. A name with no Latin letters or digits
   * (for example one written in Bangla) falls back to the product code;
   * a name another product already uses gets the product number added.
   */
  private async derivedSlug(
    name: string,
    productCode: string,
  ): Promise<string> {
    const base = slugify(name);

    if (base === '') {
      return productCode.toLowerCase();
    }

    if (!(await this.slugExists(base))) {
      return base;
    }

    const number =
      parseCode('product', productCode);

    return `${base}-${number ?? productCode.toLowerCase()}`;
  }
}
