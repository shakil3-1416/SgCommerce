import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  AuthService,
} from './auth.service';

export const ROLE_KEY =
  'sgcommerce_required_role';

export const RequireRole = (
  role: 'customer' | 'admin',
) =>
  SetMetadata(
    ROLE_KEY,
    role,
  );

@Injectable()
export class AuthGuard
  implements CanActivate
{
  constructor(
    private readonly auth:
      AuthService,

    private readonly reflector:
      Reflector,
  ) {}

  canActivate(
    context:
      ExecutionContext,
  ) {
    const request =
      context
        .switchToHttp()
        .getRequest();

    const authorization =
      String(
        request.headers
          .authorization ?? '',
      );

    if (
      !authorization.startsWith(
        'Bearer ',
      )
    ) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    const token =
      authorization
        .slice(7)
        .trim();

    const user =
      this.auth.verifyToken(
        token,
      );

    const requiredRole =
      this.reflector
        .getAllAndOverride<
          | 'customer'
          | 'admin'
          | undefined
        >(
          ROLE_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (
      requiredRole &&
      user.role !==
        requiredRole
    ) {
      throw new ForbiddenException(
        'Insufficient permissions',
      );
    }

    request.user =
      user;

    return true;
  }
}
