import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  FilterQuery,
  Model,
} from 'mongoose';

import {
  CatalogService,
} from '../catalog/catalog.service';

import {
  Inventory,
  InventoryDocument,
} from './schemas/inventory.schema';

import {
  StockMovement,
  StockMovementDocument,
} from './schemas/stock-movement.schema';

import {
  AdjustStockDto,
  InventoryQueryDto,
  UpsertInventoryDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly catalog:
      CatalogService,

    @InjectModel(Inventory.name)
    private readonly inventoryModel:
      Model<InventoryDocument>,

    @InjectModel(StockMovement.name)
    private readonly movementModel:
      Model<StockMovementDocument>,
  ) {}

  private normalizeSku(sku: string) {
    return sku.trim().toUpperCase();
  }

  private serialize(
    inventory: InventoryDocument | any,
  ) {
    const value =
      typeof inventory.toObject ===
      'function'
        ? inventory.toObject()
        : inventory;

    return {
      ...value,
      available:
        value.onHand -
        value.reserved,

      lowStock:
        value.onHand -
          value.reserved <=
        value.reorderLevel,
    };
  }

  async upsert(
    sku: string,
    dto: UpsertInventoryDto,
  ) {
    const normalized =
      this.normalizeSku(sku);

    const {
      product,
      variant,
    } =
      await this.catalog.findVariantBySku(
        normalized,
      );

    const reserved =
      dto.reserved ?? 0;

    if (reserved > dto.onHand) {
      throw new BadRequestException(
        'Reserved stock cannot exceed on-hand stock',
      );
    }

    const inventory =
      await this.inventoryModel.findOneAndUpdate(
        {
          sku: normalized,
        },
        {
          $set: {
            sku: normalized,
            productId: product._id,
            productName:
              product.name,
            variantTitle:
              variant.title,
            onHand: dto.onHand,
            reserved,
            reorderLevel:
              dto.reorderLevel ??
              5,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      );

    return this.serialize(
      inventory,
    );
  }

  async get(sku: string) {
    const normalized =
      this.normalizeSku(sku);

    const inventory =
      await this.inventoryModel
        .findOne({
          sku: normalized,
        })
        .lean();

    if (!inventory) {
      throw new NotFoundException(
        `Inventory for SKU "${normalized}" not found`,
      );
    }

    return this.serialize(
      inventory,
    );
  }

  async list(
    query: InventoryQueryDto,
  ) {
    const page =
      query.page ?? 1;

    const limit =
      query.limit ?? 50;

    const filter: FilterQuery<InventoryDocument> =
      {};

    if (query.lowStock === true) {
      filter.$expr = {
        $lte: [
          {
            $subtract: [
              '$onHand',
              '$reserved',
            ],
          },
          '$reorderLevel',
        ],
      };
    }

    const [items, total] =
      await Promise.all([
        this.inventoryModel
          .find(filter)
          .sort({
            updatedAt: -1,
          })
          .skip(
            (page - 1) * limit,
          )
          .limit(limit)
          .lean(),

        this.inventoryModel
          .countDocuments(filter),
      ]);

    return {
      items:
        items.map((item) =>
          this.serialize(item),
        ),

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

  async adjust(
    sku: string,
    dto: AdjustStockDto,
  ) {
    const normalized =
      this.normalizeSku(sku);

    if (dto.delta === 0) {
      throw new BadRequestException(
        'Stock adjustment delta cannot be zero',
      );
    }

    let inventory: InventoryDocument | null;

    if (dto.delta < 0) {
      const required =
        Math.abs(dto.delta);

      inventory =
        await this.inventoryModel.findOneAndUpdate(
          {
            sku: normalized,

            $expr: {
              $gte: [
                {
                  $subtract: [
                    '$onHand',
                    '$reserved',
                  ],
                },
                required,
              ],
            },
          },
          {
            $inc: {
              onHand:
                dto.delta,
            },
          },
          {
            new: true,
            runValidators: true,
          },
        );

      if (!inventory) {
        const exists =
          await this.inventoryModel.exists({
            sku: normalized,
          });

        if (!exists) {
          throw new NotFoundException(
            `Inventory for SKU "${normalized}" not found`,
          );
        }

        throw new BadRequestException(
          'Insufficient available stock for this adjustment',
        );
      }
    } else {
      inventory =
        await this.inventoryModel.findOneAndUpdate(
          {
            sku: normalized,
          },
          {
            $inc: {
              onHand:
                dto.delta,
            },
          },
          {
            new: true,
            runValidators: true,
          },
        );

      if (!inventory) {
        throw new NotFoundException(
          `Inventory for SKU "${normalized}" not found`,
        );
      }
    }

    await this.movementModel.create({
      sku: normalized,
      delta: dto.delta,
      reason: dto.reason,
      reference:
        dto.reference ?? '',
      resultingOnHand:
        inventory.onHand,
    });

    return this.serialize(
      inventory,
    );
  }

  async movements(
    sku: string,
  ) {
    const normalized =
      this.normalizeSku(sku);

    return this.movementModel
      .find({
        sku: normalized,
      })
      .sort({
        createdAt: -1,
      })
      .limit(200)
      .lean();
  }
}
