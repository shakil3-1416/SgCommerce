import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  RequireRole,
} from '../auth/auth.guard';

import {
  CreateReturnDto,
  UpdateReturnStatusDto,
} from './dto/return.dto';

import {
  ReturnsService,
} from './returns.service';

@Controller('returns')
export class ReturnsController {
  constructor(
    private readonly returns:
      ReturnsService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateReturnDto,
  ) {
    return this.returns
      .create(dto);
  }

  /*
   * Customer return history.
   *
   * The customer never needs to type an
   * order number or phone number to see
   * their own return requests.
   */
  @UseGuards(AuthGuard)
  @RequireRole('customer')
  @Get('me')
  mine(
    @Req()
    request: any,
  ) {
    return this.returns
      .listForCustomer(
        request.user
          .customerId,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Get()
  list(
    @Query('status')
    status?: string,
  ) {
    return this.returns
      .list(status);
  }

  @Get(':returnNumber')
  get(
    @Param('returnNumber')
    returnNumber: string,
  ) {
    return this.returns
      .get(returnNumber);
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Patch(
    ':returnNumber/status',
  )
  updateStatus(
    @Param('returnNumber')
    returnNumber: string,

    @Body()
    dto:
      UpdateReturnStatusDto,
  ) {
    return this.returns
      .updateStatus(
        returnNumber,
        dto,
      );
  }
}
