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

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
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

  private async assertUniqueVariants(
    variants: Array<{ sku: string }>,
    excludeProductId?: string,
  ) {
    const skus =
      variants.map((variant) =>
        this.normalizeSku(variant.sku),
      );

    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException(
        'Duplicate SKU found in product variants',
      );
    }

    const filter: FilterQuery<ProductDocument> = {
      'variants.sku': {
        $in: skus,
      },
    };

    if (excludeProductId) {
      filter._id = {
        $ne: excludeProductId,
      };
    }

    const collision =
      await this.productModel
        .findOne(filter)
        .select({
          name: 1,
          'variants.sku': 1,
        })
        .lean();

    if (collision) {
      throw new ConflictException(
        'One or more SKUs already exist',
      );
    }
  }

  async createProduct(dto: CreateProductDto) {
    const category =
      await this.resolveCategory(dto.category);

    const slug =
      this.slugify(dto.slug ?? dto.name);

    if (!slug) {
      throw new BadRequestException(
        'Product slug cannot be empty',
      );
    }

    const slugExists =
      await this.productModel.exists({
        slug,
      });

    if (slugExists) {
      throw new ConflictException(
        `Product slug "${slug}" already exists`,
      );
    }

    await this.assertUniqueVariants(
      dto.variants,
    );

    const variants =
      dto.variants.map((variant) => ({
        ...variant,
        sku: this.normalizeSku(
          variant.sku,
        ),
      }));

    const product =
      await this.productModel.create({
        ...dto,
        category: category._id,
        slug,
        variants,
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
    const page = query.page ?? 1;

    const limit =
      Math.min(query.limit ?? 20, 100);

    const filter: FilterQuery<ProductDocument> =
      {};

    if (query.active !== undefined) {
      filter.active = query.active;
    }

    if (query.category) {
      const category =
        await this.resolveCategory(
          query.category,
        );

      filter.category = category._id;
    }

    if (query.q?.trim()) {
      filter.$or = [
        {
          name: {
            $regex: query.q.trim(),
            $options: 'i',
          },
        },
        {
          description: {
            $regex: query.q.trim(),
            $options: 'i',
          },
        },
        {
          brand: {
            $regex: query.q.trim(),
            $options: 'i',
          },
        },
        {
          'variants.sku': {
            $regex: query.q.trim(),
            $options: 'i',
          },
        },
      ];
    }

    const [items, total] =
      await Promise.all([
        this.productModel
          .find(filter)
          .populate(
            'category',
            'name slug active',
          )
          .sort({
            createdAt: -1,
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),

        this.productModel.countDocuments(
          filter,
        ),
      ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(
          total / limit,
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

    if (dto.slug || dto.name) {
      const slug =
        this.slugify(
          dto.slug ??
            dto.name ??
            existing.name,
        );

      const collision =
        await this.productModel.exists({
          _id: {
            $ne: id,
          },
          slug,
        });

      if (collision) {
        throw new ConflictException(
          'Product slug already exists',
        );
      }

      update.slug = slug;
    }

    if (dto.variants) {
      await this.assertUniqueVariants(
        dto.variants,
        id,
      );

      update.variants =
        dto.variants.map(
          (variant) => ({
            ...variant,
            sku: this.normalizeSku(
              variant.sku,
            ),
          }),
        );
    }

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
