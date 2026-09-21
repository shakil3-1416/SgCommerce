import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

import {
  Types,
} from 'mongoose';

import {
  CustomersService,
} from '../customers/customers.service';

import {
  OrdersService,
} from '../orders/orders.service';

import {
  UsersService,
} from '../users/users.service';

import {
  AddAddressDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

interface TokenPayload {
  sub: string;
  role: 'customer' | 'admin';
  customerId?: string;
  email: string;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly secret:
    string;

  constructor(
    private readonly config:
      ConfigService,

    private readonly users:
      UsersService,

    private readonly customers:
      CustomersService,

    private readonly orders:
      OrdersService,
  ) {
    const configuredSecret =
      this.config.get<string>(
        'AUTH_SECRET',
      );

    if (
      process.env.NODE_ENV ===
        'production' &&
      (
        !configuredSecret ||
        configuredSecret.length < 32
      )
    ) {
      throw new Error(
        'AUTH_SECRET must be configured with at least 32 characters in production',
      );
    }

    this.secret =
      configuredSecret ??
      'sgcommerce-local-development-secret-change-before-production';
  }

  private base64url(
    value:
      | string
      | Buffer,
  ) {
    return Buffer.from(
      value,
    ).toString(
      'base64url',
    );
  }

  private hashPassword(
    password: string,
    salt?: string,
  ) {
    const actualSalt =
      salt ??
      randomBytes(24)
        .toString('hex');

    const hash =
      pbkdf2Sync(
        password,
        actualSalt,
        210000,
        64,
        'sha512',
      ).toString('hex');

    return {
      salt:
        actualSalt,
      hash,
    };
  }

  private verifyPassword(
    password: string,
    salt: string,
    expectedHash: string,
  ) {
    const {
      hash,
    } =
      this.hashPassword(
        password,
        salt,
      );

    const actual =
      Buffer.from(
        hash,
        'hex',
      );

    const expected =
      Buffer.from(
        expectedHash,
        'hex',
      );

    return (
      actual.length ===
        expected.length &&
      timingSafeEqual(
        actual,
        expected,
      )
    );
  }

  private signToken(
    payload:
      Omit<
        TokenPayload,
        'exp'
      >,
  ) {
    const header =
      this.base64url(
        JSON.stringify({
          alg: 'HS256',
          typ: 'JWT',
        }),
      );

    const body =
      this.base64url(
        JSON.stringify({
          ...payload,
          exp:
            Math.floor(
              Date.now() /
                1000,
            ) +
            60 * 60 * 8,
        }),
      );

    const content =
      `${header}.${body}`;

    const signature =
      createHmac(
        'sha256',
        this.secret,
      )
        .update(content)
        .digest(
          'base64url',
        );

    return `${content}.${signature}`;
  }

  verifyToken(
    token: string,
  ): TokenPayload {
    const parts =
      token.split('.');

    if (
      parts.length !== 3
    ) {
      throw new UnauthorizedException(
        'Invalid token',
      );
    }

    const [
      header,
      body,
      signature,
    ] = parts;

    const expected =
      createHmac(
        'sha256',
        this.secret,
      )
        .update(
          `${header}.${body}`,
        )
        .digest(
          'base64url',
        );

    const actualBuffer =
      Buffer.from(
        signature,
      );

    const expectedBuffer =
      Buffer.from(
        expected,
      );

    if (
      actualBuffer.length !==
        expectedBuffer.length ||
      !timingSafeEqual(
        actualBuffer,
        expectedBuffer,
      )
    ) {
      throw new UnauthorizedException(
        'Invalid token',
      );
    }

    let payload:
      TokenPayload;

    try {
      payload =
        JSON.parse(
          Buffer.from(
            body,
            'base64url',
          ).toString(
            'utf8',
          ),
        );
    } catch {
      throw new UnauthorizedException(
        'Invalid token',
      );
    }

    if (
      !payload.exp ||
      payload.exp <
        Math.floor(
          Date.now() /
            1000,
        )
    ) {
      throw new UnauthorizedException(
        'Token expired',
      );
    }

    return payload;
  }

  async register(
    dto: RegisterDto,
  ) {
    const existing =
      await this.users
        .findByIdentifier(
          dto.email,
        );

    if (existing) {
      throw new ConflictException(
        'Account already exists',
      );
    }

    const customer =
      await this.customers
        .upsertFromCheckout({
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
        });

    const {
      salt,
      hash,
    } =
      this.hashPassword(
        dto.password,
      );

    const user =
      await this.users.create({
        email:
          dto.email,
        phone:
          dto.phone,
        passwordHash:
          hash,
        passwordSalt:
          salt,
        role:
          'customer',
        customerId:
          new Types.ObjectId(
            String(
              customer._id,
            ),
          ),
      });

    return this.issueSession(
      user,
    );
  }

  async login(
    dto: LoginDto,
  ) {
    const user =
      await this.users
        .findByIdentifier(
          dto.identifier,
        );

    if (
      !user ||
      !user.active ||
      !this.verifyPassword(
        dto.password,
        user.passwordSalt,
        user.passwordHash,
      )
    ) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    return this.issueSession(
      user,
    );
  }

  private issueSession(
    user: {
      _id: unknown;
      email: string;
      role: string;
      customerId:
        | Types.ObjectId
        | null;
    },
  ) {
    const role =
      user.role ===
        'admin'
        ? 'admin'
        : 'customer';

    const token =
      this.signToken({
        sub:
          String(user._id),

        role,

        customerId:
          user.customerId
            ? String(
                user.customerId,
              )
            : undefined,

        email:
          user.email,
      });

    return {
      token,
      user: {
        id:
          String(user._id),
        email:
          user.email,
        role,
        customerId:
          user.customerId
            ? String(
                user.customerId,
              )
            : null,
      },
    };
  }

  async me(
    payload:
      TokenPayload,
  ) {
    if (
      payload.role ===
      'admin'
    ) {
      return {
        id:
          payload.sub,
        email:
          payload.email,
        role:
          payload.role,
      };
    }

    if (
      !payload.customerId
    ) {
      throw new UnauthorizedException(
        'Customer account is incomplete',
      );
    }

    const customer =
      await this.customers
        .getById(
          payload.customerId,
        );

    return {
      id:
        payload.sub,
      email:
        payload.email,
      role:
        payload.role,
      customer:
        customer.toObject(),
    };
  }

  async updateProfile(
    payload:
      TokenPayload,
    dto: UpdateProfileDto,
  ) {
    if (
      payload.role !==
        'customer' ||
      !payload.customerId
    ) {
      throw new UnauthorizedException();
    }

    return this.customers
      .updateProfile(
        payload.customerId,
        dto,
      );
  }

  async addAddress(
    payload:
      TokenPayload,
    dto: AddAddressDto,
  ) {
    if (
      payload.role !==
        'customer' ||
      !payload.customerId
    ) {
      throw new UnauthorizedException();
    }

    return this.customers
      .addAddress(
        payload.customerId,
        dto,
      );
  }

  async removeAddress(
    payload:
      TokenPayload,
    addressId: string,
  ) {
    if (
      payload.role !==
        'customer' ||
      !payload.customerId
    ) {
      throw new UnauthorizedException();
    }

    return this.customers
      .removeAddress(
        payload.customerId,
        addressId,
      );
  }

  async myOrders(
    payload:
      TokenPayload,
  ) {
    if (
      payload.role !==
        'customer' ||
      !payload.customerId
    ) {
      throw new UnauthorizedException();
    }

    return this.orders
      .listForCustomer(
        payload.customerId,
      );
  }

  async ensureAdmin(
    email: string,
    phone: string,
    password: string,
  ) {
    const {
      salt,
      hash,
    } =
      this.hashPassword(
        password,
      );

    return this.users
      .ensureAdmin({
        email,
        phone,
        passwordHash:
          hash,
        passwordSalt:
          salt,
      });
  }
}
