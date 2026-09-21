import { Injectable } from '@nestjs/common';

@Injectable()
export class SupgentService {
  getCapabilities() {
    return {
      integration: 'supgent-commerce',

      version: 'v1',

      capabilities: [
        'product.search',
        'product.get',
        'inventory.check',
        'customer.lookup',
        'order.lookup',
        'order.track',
        'order.cancel',
        'return.create',
        'refund.request',
      ],

      architecture: {
        databaseAccess: false,
        communication: [
          'REST',
          'webhooks',
        ],
      },
    };
  }
}
