import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  RequireRole,
} from '../auth/auth.guard';

import {
  CustomersService,
} from './customers.service';

@Controller('customers')
@UseGuards(AuthGuard)
@RequireRole('admin')
export class CustomersController {
  constructor(
    private readonly customers:
      CustomersService,
  ) {}

  @Get()
  list() {
    return this.customers
      .list();
  }
}
