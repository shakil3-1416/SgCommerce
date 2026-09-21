import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from './auth.guard';

import {
  AuthService,
} from './auth.service';

import {
  AddAddressDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth:
      AuthService,
  ) {}

  @Post('register')
  register(
    @Body()
    dto: RegisterDto,
  ) {
    return this.auth
      .register(dto);
  }

  @Post('login')
  login(
    @Body()
    dto: LoginDto,
  ) {
    return this.auth
      .login(dto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(
    @Req()
    request: any,
  ) {
    return this.auth.me(
      request.user,
    );
  }

  @UseGuards(AuthGuard)
  @Patch('me/profile')
  updateProfile(
    @Req()
    request: any,

    @Body()
    dto: UpdateProfileDto,
  ) {
    return this.auth
      .updateProfile(
        request.user,
        dto,
      );
  }

  @UseGuards(AuthGuard)
  @Post('me/addresses')
  addAddress(
    @Req()
    request: any,

    @Body()
    dto: AddAddressDto,
  ) {
    return this.auth
      .addAddress(
        request.user,
        dto,
      );
  }

  @UseGuards(AuthGuard)
  @Delete(
    'me/addresses/:addressId',
  )
  removeAddress(
    @Req()
    request: any,

    @Param('addressId')
    addressId: string,
  ) {
    return this.auth
      .removeAddress(
        request.user,
        addressId,
      );
  }

  @UseGuards(AuthGuard)
  @Get('me/orders')
  myOrders(
    @Req()
    request: any,
  ) {
    return this.auth
      .myOrders(
        request.user,
      );
  }
}
