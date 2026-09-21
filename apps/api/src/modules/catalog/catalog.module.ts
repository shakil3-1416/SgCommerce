import {
  AuthModule,
} from '../auth/auth.module';

import {
  forwardRef,
  Module,
} from '@nestjs/common';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  CatalogController,
} from './catalog.controller';

import {
  CatalogService,
} from './catalog.service';

import {
  Category,
  CategorySchema,
} from './schemas/category.schema';

import {
  Product,
  ProductSchema,
} from './schemas/product.schema';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      {
        name: Category.name,
        schema: CategorySchema,
      },
      {
        name: Product.name,
        schema: ProductSchema,
      },
    ]),
  ],

  controllers: [
    CatalogController,
  ],

  providers: [
    CatalogService,
  ],

  exports: [
    CatalogService,
    MongooseModule,
  ],
})
export class CatalogModule {}
