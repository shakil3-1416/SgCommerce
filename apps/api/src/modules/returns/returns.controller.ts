import {
  Body,
  Controller,
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
    dto:
      CreateReturnDto,
  ) {
    return this.returns
      .create(dto);
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

  @UseGuards(AuthGuard)
  @RequireRole('admin')
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
  update(
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
