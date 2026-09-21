import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  randomUUID,
} from 'crypto';

import {
  CheckoutCustomerDto,
} from './dto/customer.dto';

import {
  Customer,
  CustomerDocument,
} from './schemas/customer.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel:
      Model<CustomerDocument>,
  ) {}

  normalizePhone(
    value: string,
  ) {
    return value
      .trim()
      .replace(/\s+/g, '');
  }

  async upsertFromCheckout(
    dto: CheckoutCustomerDto,
  ) {
    const phone =
      this.normalizePhone(
        dto.phone,
      );

    return this.customerModel.findOneAndUpdate(
      {
        phone,
      },
      {
        $set: {
          name:
            dto.name.trim(),
          phone,
          email:
            dto.email
              ?.trim()
              .toLowerCase() ??
            '',
          active: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );
  }

  async getById(
    id: string,
  ) {
    if (
      !Types.ObjectId.isValid(
        id,
      )
    ) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    const customer =
      await this.customerModel
        .findById(id);

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    return customer;
  }

  async updateProfile(
    id: string,
    input: {
      name?: string;
      email?: string;
      phone?: string;
    },
  ) {
    const customer =
      await this.getById(id);

    if (
      input.name !==
      undefined
    ) {
      customer.name =
        input.name.trim();
    }

    if (
      input.email !==
      undefined
    ) {
      customer.email =
        input.email
          .trim()
          .toLowerCase();
    }

    if (
      input.phone !==
      undefined
    ) {
      customer.phone =
        this.normalizePhone(
          input.phone,
        );
    }

    await customer.save();

    return customer.toObject();
  }

  async addAddress(
    id: string,
    input: {
      label: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      area?: string;
      postalCode?: string;
      zone:
        | 'inside_dhaka'
        | 'outside_dhaka';
      isDefault?: boolean;
    },
  ) {
    const customer =
      await this.getById(id);

    if (
      input.isDefault
    ) {
      for (
        const address
        of customer.addresses
      ) {
        address.isDefault =
          false;
      }
    }

    const address = {
      id: randomUUID(),
      label:
        input.label.trim(),
      addressLine1:
        input.addressLine1.trim(),
      addressLine2:
        input.addressLine2?.trim() ??
        '',
      city:
        input.city.trim(),
      area:
        input.area?.trim() ??
        '',
      postalCode:
        input.postalCode?.trim() ??
        '',
      zone:
        input.zone,
      isDefault:
        Boolean(
          input.isDefault,
        ),
    };

    customer.addresses.push(
      address,
    );

    await customer.save();

    return customer.toObject();
  }

  async removeAddress(
    id: string,
    addressId: string,
  ) {
    const customer =
      await this.getById(id);

    customer.addresses =
      customer.addresses.filter(
        (address) =>
          address.id !==
          addressId,
      );

    await customer.save();

    return customer.toObject();
  }

  async list() {
    return this.customerModel
      .find()
      .sort({
        createdAt: -1,
      })
      .lean();
  }
}
