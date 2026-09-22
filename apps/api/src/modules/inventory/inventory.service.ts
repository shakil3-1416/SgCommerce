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

type StockAdjustmentInput =
  AdjustStockDto & {
    idempotencyKey?: string;
  };


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
    dto: StockAdjustmentInput,
  ) {
    const normalized =
      this.normalizeSku(sku);

    if (dto.delta === 0) {
      throw new BadRequestException(
        'Stock adjustment delta cannot be zero',
      );
    }

    const idempotencyKey =
      dto.idempotencyKey
        ?.trim()
        .slice(
          0,
          240,
        ) ||
      undefined;

    const recordMovement =
      async (
        resultingOnHand:
          number,
      ) => {
        const movement:
          Record<
            string,
            unknown
          > = {
            sku:
              normalized,

            delta:
              dto.delta,

            reason:
              dto.reason,

            reference:
              dto.reference ??
              '',

            resultingOnHand,
          };

        if (
          idempotencyKey
        ) {
          movement.idempotencyKey =
            idempotencyKey;
        }

        try {
          await this.movementModel
            .create(
              movement,
            );
        } catch (error) {
          const duplicate =
            idempotencyKey &&
            typeof error ===
              'object' &&
            error !== null &&
            'code' in error &&
            (
              error as {
                code?:
                  number;
              }
            ).code ===
              11000;

          if (!duplicate) {
            throw error;
          }
        }
      };

    const alreadyApplied =
      async () => {
        if (
          !idempotencyKey
        ) {
          return null;
        }

        return this.inventoryModel
          .findOne({
            sku:
              normalized,

            appliedAdjustments:
              idempotencyKey,
          });
      };

    const update:
      Record<
        string,
        any
      > = {
        $inc: {
          onHand:
            dto.delta,
        },
      };

    if (
      idempotencyKey
    ) {
      update.$addToSet = {
        appliedAdjustments:
          idempotencyKey,
      };
    }

    const baseFilter:
      Record<
        string,
        any
      > = {
        sku:
          normalized,
      };

    if (
      idempotencyKey
    ) {
      baseFilter.appliedAdjustments =
        {
          $ne:
            idempotencyKey,
        };
    }

    let inventory:
      InventoryDocument |
      null;

    if (
      dto.delta <
      0
    ) {
      const required =
        Math.abs(
          dto.delta,
        );

      inventory =
        await this.inventoryModel
          .findOneAndUpdate(
            {
              ...baseFilter,

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
            update,
            {
              new: true,
              runValidators:
                true,
            },
          );

      if (!inventory) {
        const prior =
          await alreadyApplied();

        if (prior) {
          await recordMovement(
            prior.onHand,
          );

          return this.serialize(
            prior,
          );
        }

        const exists =
          await this.inventoryModel
            .exists({
              sku:
                normalized,
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
        await this.inventoryModel
          .findOneAndUpdate(
            baseFilter,
            update,
            {
              new: true,
              runValidators:
                true,
            },
          );

      if (!inventory) {
        const prior =
          await alreadyApplied();

        if (prior) {
          await recordMovement(
            prior.onHand,
          );

          return this.serialize(
            prior,
          );
        }

        throw new NotFoundException(
          `Inventory for SKU "${normalized}" not found`,
        );
      }
    }

    await recordMovement(
      inventory.onHand,
    );

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
