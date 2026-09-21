import {
  ConflictException,
  Injectable,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  User,
  UserDocument,
} from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel:
      Model<UserDocument>,
  ) {}

  normalizeEmail(
    value: string,
  ) {
    return value
      .trim()
      .toLowerCase();
  }

  normalizePhone(
    value: string,
  ) {
    return value
      .trim()
      .replace(/\s+/g, '');
  }

  async findByIdentifier(
    identifier: string,
  ) {
    const value =
      identifier.trim();

    return this.userModel.findOne({
      $or: [
        {
          email:
            value.toLowerCase(),
        },
        {
          phone:
            this.normalizePhone(
              value,
            ),
        },
      ],
    });
  }

  async findById(
    id: string,
  ) {
    if (
      !Types.ObjectId.isValid(
        id,
      )
    ) {
      return null;
    }

    return this.userModel
      .findById(id);
  }

  async create(input: {
    email: string;
    phone: string;
    passwordHash: string;
    passwordSalt: string;
    role: 'customer' | 'admin';
    customerId?: Types.ObjectId | null;
  }) {
    const email =
      this.normalizeEmail(
        input.email,
      );

    const phone =
      this.normalizePhone(
        input.phone,
      );

    const exists =
      await this.userModel.findOne({
        $or: [
          { email },
          { phone },
        ],
      });

    if (exists) {
      throw new ConflictException(
        'An account already exists with this email or phone',
      );
    }

    return this.userModel.create({
      email,
      phone,
      passwordHash:
        input.passwordHash,
      passwordSalt:
        input.passwordSalt,
      role:
        input.role,
      customerId:
        input.customerId ??
        null,
      active: true,
    });
  }

  async ensureAdmin(input: {
    email: string;
    phone: string;
    passwordHash: string;
    passwordSalt: string;
  }) {
    const email =
      this.normalizeEmail(
        input.email,
      );

    const existing =
      await this.userModel.findOne({
        email,
      });

    if (existing) {
      existing.role =
        'admin';

      existing.phone =
        this.normalizePhone(
          input.phone,
        );

      existing.passwordHash =
        input.passwordHash;

      existing.passwordSalt =
        input.passwordSalt;

      existing.active = true;

      await existing.save();

      return existing;
    }

    return this.userModel.create({
      email,
      phone:
        this.normalizePhone(
          input.phone,
        ),
      passwordHash:
        input.passwordHash,
      passwordSalt:
        input.passwordSalt,
      role: 'admin',
      customerId: null,
      active: true,
    });
  }
}
