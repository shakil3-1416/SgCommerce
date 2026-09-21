import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  RequireRole,
} from '../auth/auth.guard';

import {
  CatalogService,
} from './catalog.service';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Controller()
export class CatalogController {
  constructor(
    private readonly catalog:
      CatalogService,
  ) {}

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Post('categories')
  createCategory(
    @Body()
    dto:
      CreateCategoryDto,
  ) {
    return this.catalog
      .createCategory(dto);
  }

  @Get('categories')
  listCategories() {
    return this.catalog
      .listCategories();
  }

  @Get(
    'categories/:idOrSlug',
  )
  getCategory(
    @Param('idOrSlug')
    idOrSlug: string,
  ) {
    return this.catalog
      .getCategory(
        idOrSlug,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Patch('categories/:id')
  updateCategory(
    @Param('id')
    id: string,

    @Body()
    dto:
      UpdateCategoryDto,
  ) {
    return this.catalog
      .updateCategory(
        id,
        dto,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Delete('categories/:id')
  deleteCategory(
    @Param('id')
    id: string,
  ) {
    return this.catalog
      .deleteCategory(id);
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Post('products')
  createProduct(
    @Body()
    dto:
      CreateProductDto,
  ) {
    return this.catalog
      .createProduct(dto);
  }

  @Get('products')
  listProducts(
    @Query()
    query:
      ProductQueryDto,
  ) {
    return this.catalog
      .listProducts(
        query,
      );
  }

  @Get(
    'products/:idOrSlug',
  )
  getProduct(
    @Param('idOrSlug')
    idOrSlug: string,
  ) {
    return this.catalog
      .getProduct(
        idOrSlug,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Patch('products/:id')
  updateProduct(
    @Param('id')
    id: string,

    @Body()
    dto:
      UpdateProductDto,
  ) {
    return this.catalog
      .updateProduct(
        id,
        dto,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Delete('products/:id')
  deleteProduct(
    @Param('id')
    id: string,
  ) {
    return this.catalog
      .deleteProduct(id);
  }
}
