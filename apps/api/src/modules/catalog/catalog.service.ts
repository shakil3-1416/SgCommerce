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
  Category,
  CategoryDocument,
} from './schemas/category.schema';

import {
  Product,
  ProductDocument,
} from './schemas/product.schema';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

import {
  ProductIdentityService,
} from './product-identity.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,

    private readonly identity: ProductIdentityService,
  ) {}

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeSku(value: string): string {
    return value.trim().toUpperCase();
  }

  private escapeRegex(value: string): string {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 11000
    );
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug =
      this.slugify(dto.slug ?? dto.name);

    if (!slug) {
      throw new BadRequestException(
        'Category slug cannot be empty',
      );
    }

    const exists =
      await this.categoryModel.exists({ slug });

    if (exists) {
      throw new ConflictException(
        `Category slug "${slug}" already exists`,
      );
    }

    return this.categoryModel.create({
      ...dto,
      slug,
    });
  }

  async listCategories() {
    return this.categoryModel
      .find()
      .sort({
        name: 1,
      })
      .lean();
  }

  async getCategory(idOrSlug: string) {
    const query =
      Types.ObjectId.isValid(idOrSlug)
        ? {
            $or: [
              { _id: idOrSlug },
              { slug: idOrSlug.toLowerCase() },
            ],
          }
        : {
            slug: idOrSlug.toLowerCase(),
          };

    const category =
      await this.categoryModel.findOne(query).lean();

    if (!category) {
      throw new NotFoundException(
        'Category not found',
      );
    }

    return category;
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'Invalid category ID',
      );
    }

    const update: Record<string, unknown> = {
      ...dto,
    };

    if (dto.slug || dto.name) {
      update.slug =
        this.slugify(dto.slug ?? dto.name!);

      const collision =
        await this.categoryModel.exists({
          _id: {
            $ne: id,
          },
          slug: update.slug,
        });

      if (collision) {
        throw new ConflictException(
          'Category slug already exists',
        );
      }
    }

    const category =
      await this.categoryModel
        .findByIdAndUpdate(
          id,
          update,
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

    if (!category) {
      throw new NotFoundException(
        'Category not found',
      );
    }

    return category;
  }

  async deleteCategory(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'Invalid category ID',
      );
    }

    const productCount =
      await this.productModel.countDocuments({
        category: id,
      });

    if (productCount > 0) {
      throw new ConflictException(
        'Category contains products and cannot be deleted',
      );
    }

    const deleted =
      await this.categoryModel
        .findByIdAndDelete(id)
        .lean();

    if (!deleted) {
      throw new NotFoundException(
        'Category not found',
      );
    }

    return {
      deleted: true,
      id,
    };
  }

  private async resolveCategory(
    value: string,
  ): Promise<CategoryDocument> {
    let category: CategoryDocument | null;

    if (Types.ObjectId.isValid(value)) {
      category =
        await this.categoryModel.findById(value);
    } else {
      category =
        await this.categoryModel.findOne({
          slug: value.toLowerCase(),
        });
    }

    if (!category) {
      throw new BadRequestException(
        `Category "${value}" does not exist`,
      );
    }

    return category;
  }

  async createProduct(dto: CreateProductDto) {
    const category =
      await this.resolveCategory(dto.category);

    /*
     * Product code, slug and SKUs come from one place. Typed values are
     * validated first, so a rejected request does not use up a product
     * code.
     */
    const identity =
      await this.identity.assign({
        name: dto.name,
        slug: dto.slug,
        variants: dto.variants,
      });

    const variants =
      dto.variants.map((variant, index) => ({
        ...variant,
        sku: identity.skus[index],
      }));

    const product =
      await this.productModel
        .create({
          ...dto,
          category: category._id,
          slug: identity.slug,
          productCode: identity.productCode,
          lastVariantNumber:
            identity.lastVariantNumber,
          variants,
        })
        .catch((error: unknown) => {
          if (this.isDuplicateKeyError(error)) {
            throw new ConflictException(
              'Another product was saved with the same slug or SKU at the same moment. Save again.',
            );
          }

          throw error;
        });

    return this.productModel
      .findById(product._id)
      .populate(
        'category',
        'name slug active',
      )
      .lean();
  }

  async listProducts(
    query: ProductQueryDto,
  ) {
    const page =
      query.page ?? 1;

    const limit =
      Math.min(
        query.limit ?? 24,
        100,
      );

    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice >
        query.maxPrice
    ) {
      throw new BadRequestException(
        'minPrice cannot be greater than maxPrice',
      );
    }

    const filter:
      FilterQuery<ProductDocument> =
      {};

    if (
      query.active !==
      undefined
    ) {
      filter.active =
        query.active;
    }

    if (
      query.category
    ) {
      const category =
        await this.resolveCategory(
          query.category,
        );

      filter.category =
        category._id;
    }

    if (
      query.brand?.trim()
    ) {
      const escapedBrand =
        this.escapeRegex(
          query.brand.trim(),
        );

      filter.brand = {
        $regex:
          `^${escapedBrand}$`,
        $options:
          'i',
      };
    }

    if (
      query.minPrice !==
        undefined ||
      query.maxPrice !==
        undefined
    ) {
      const priceFilter: {
        $gte?: number;
        $lte?: number;
      } = {};

      if (
        query.minPrice !==
        undefined
      ) {
        priceFilter.$gte =
          query.minPrice;
      }

      if (
        query.maxPrice !==
        undefined
      ) {
        priceFilter.$lte =
          query.maxPrice;
      }

      filter[
        'variants.price'
      ] =
        priceFilter;
    }

    if (
      query.q?.trim()
    ) {
      /*
       * The search text is matched literally. Without escaping, a
       * visitor could send their own regular expression to the
       * database through this public endpoint.
       */
      const search =
        this.escapeRegex(
          query.q.trim(),
        );

      filter.$or = [
        {
          name: {
            $regex:
              search,
            $options:
              'i',
          },
        },
        {
          description: {
            $regex:
              search,
            $options:
              'i',
          },
        },
        {
          brand: {
            $regex:
              search,
            $options:
              'i',
          },
        },
        {
          'variants.sku': {
            $regex:
              search,
            $options:
              'i',
          },
        },
        {
          productCode: {
            $regex:
              search,
            $options:
              'i',
          },
        },
      ];
    }

    const sort:
      Record<
        string,
        1 | -1
      > =
      query.sort ===
      'price_asc'
        ? {
            'variants.price':
              1,
          }
        : query.sort ===
            'price_desc'
          ? {
              'variants.price':
                -1,
            }
          : query.sort ===
              'name_asc'
            ? {
                name: 1,
              }
            : {
                createdAt:
                  -1,
              };

    const [
      items,
      total,
    ] =
      await Promise.all([
        this.productModel
          .find(filter)
          .populate(
            'category',
            'name slug active',
          )
          .sort(sort)
          .skip(
            (page - 1) *
              limit,
          )
          .limit(limit)
          .lean(),

        this.productModel
          .countDocuments(
            filter,
          ),
      ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages:
          Math.ceil(
            total /
              limit,
          ),
      },
    };
  }

  async getProduct(idOrSlug: string) {
    const query =
      Types.ObjectId.isValid(idOrSlug)
        ? {
            $or: [
              { _id: idOrSlug },
              {
                slug:
                  idOrSlug.toLowerCase(),
              },
            ],
          }
        : {
            slug:
              idOrSlug.toLowerCase(),
          };

    const product =
      await this.productModel
        .findOne(query)
        .populate(
          'category',
          'name slug active',
        )
        .lean();

    if (!product) {
      throw new NotFoundException(
        'Product not found',
      );
    }

    return product;
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'Invalid product ID',
      );
    }

    const existing =
      await this.productModel.findById(id);

    if (!existing) {
      throw new NotFoundException(
        'Product not found',
      );
    }

    const update: Record<string, unknown> = {
      ...dto,
    };

    if (dto.category) {
      const category =
        await this.resolveCategory(
          dto.category,
        );

      update.category = category._id;
    }

    /*
     * The slug only changes when one is sent explicitly. Renaming a
     * product keeps its address, so links and search results that
     * point at it keep working.
     */
    if (dto.slug !== undefined) {
      update.slug =
        await this.identity.typedSlug(
          dto.slug,
          id,
        );
    }

    if (dto.variants) {
      const productCode =
        await this.identity.ensureProductCode(
          existing,
        );

      const {
        skus,
        lastVariantNumber,
      } =
        await this.identity.completeVariantSkus({
          productId: id,
          productCode,
          variants: dto.variants,
          lastVariantNumber:
            existing.lastVariantNumber,
          currentSkus:
            existing.variants.map(
              (variant) => variant.sku,
            ),
        });

      update.variants =
        dto.variants.map(
          (variant, index) => ({
            ...variant,
            sku: skus[index],
          }),
        );

      update.lastVariantNumber =
        lastVariantNumber;
    }

    try {
      const product =
        await this.productModel
          .findByIdAndUpdate(
            id,
            update,
            {
              new: true,
              runValidators: true,
            },
          )
          .populate(
            'category',
            'name slug active',
          )
          .lean();

      return product;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'Another product was saved with the same slug or SKU at the same moment. Save again.',
        );
      }

      throw error;
    }
  }

  async deleteProduct(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'Invalid product ID',
      );
    }

    const deleted =
      await this.productModel
        .findByIdAndDelete(id)
        .lean();

    if (!deleted) {
      throw new NotFoundException(
        'Product not found',
      );
    }

    return {
      deleted: true,
      id,
    };
  }

  async findVariantBySku(sku: string) {
    const normalized =
      this.normalizeSku(sku);

    const product =
      await this.productModel
        .findOne({
          'variants.sku': normalized,
        })
        .lean();

    if (!product) {
      throw new NotFoundException(
        `SKU "${normalized}" not found`,
      );
    }

    const variant =
      product.variants.find(
        (item) =>
          item.sku === normalized,
      );

    if (!variant) {
      throw new NotFoundException(
        `SKU "${normalized}" not found`,
      );
    }

    return {
      product,
      variant,
    };
  }
}
