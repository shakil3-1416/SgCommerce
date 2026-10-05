/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/common/delivery-zone.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deliveryZoneFor } from './delivery-zone';

describe('deliveryZoneFor', () => {
  it('treats Dhaka district as inside Dhaka, however it is written', () => {
    for (const district of ['Dhaka', 'dhaka', ' DHAKA ', '\u09a2\u09be\u0995\u09be']) {
      assert.equal(deliveryZoneFor(district), 'inside_dhaka', JSON.stringify(district));
    }
  });

  it('treats every other district as outside Dhaka', () => {
    for (const district of ['Pabna', 'Gazipur', 'Narayanganj', 'Chattogram', 'Sylhet']) {
      assert.equal(deliveryZoneFor(district), 'outside_dhaka', district);
    }
  });

  it('charges the outside rate when the value is empty or not a district', () => {
    for (const district of ['', '   ', 'Dhaka Division', 'Dhakaa', 'Mirpur']) {
      assert.equal(deliveryZoneFor(district), 'outside_dhaka', JSON.stringify(district));
    }
  });
});
