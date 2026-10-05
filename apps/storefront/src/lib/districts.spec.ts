/**
 * Run with (tsx is installed in the api workspace):
 *   pnpm --filter api exec tsx --test ../storefront/src/lib/districts.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DELIVERY_FEE, deliveryZoneFor, DISTRICTS, matchDistrict, ZONE_LABEL } from './districts';

describe('DISTRICTS', () => {
  it('lists all 64 districts once, in alphabetical order', () => {
    assert.equal(DISTRICTS.length, 64);
    assert.equal(new Set(DISTRICTS).size, 64);
    assert.deepEqual([...DISTRICTS], [...DISTRICTS].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('has the right number of districts in each division', () => {
    const divisions: Record<string, string[]> = {
      Barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
      Chattogram: ['Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', "Cox's Bazar", 'Cumilla', 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'],
      Dhaka: ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
      Khulna: ['Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
      Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
      Rajshahi: ['Bogura', 'Chapainawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
      Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
      Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
    };
    const fromDivisions = Object.values(divisions).flat().sort((a, b) => a.localeCompare(b, 'en'));

    assert.deepEqual(fromDivisions, [...DISTRICTS]);
  });
});

describe('deliveryZoneFor', () => {
  it('charges the inside rate for Dhaka district only', () => {
    assert.equal(deliveryZoneFor('Dhaka'), 'inside_dhaka');
    assert.equal(deliveryZoneFor(' dhaka '), 'inside_dhaka');
    assert.equal(DELIVERY_FEE[deliveryZoneFor('Dhaka')], 80);

    for (const district of DISTRICTS.filter((name) => name !== 'Dhaka')) {
      assert.equal(deliveryZoneFor(district), 'outside_dhaka', district);
      assert.equal(DELIVERY_FEE[deliveryZoneFor(district)], 150);
    }
  });

  it('charges the outside rate when nothing is chosen', () => {
    assert.equal(deliveryZoneFor(''), 'outside_dhaka');
  });

  it('has a label for both zones', () => {
    assert.equal(ZONE_LABEL.inside_dhaka, 'Inside Dhaka');
    assert.equal(ZONE_LABEL.outside_dhaka, 'Outside Dhaka');
  });
});

describe('matchDistrict', () => {
  it('finds every district by its own name, whatever the case or spacing', () => {
    for (const district of DISTRICTS) {
      assert.equal(matchDistrict(district), district);
      assert.equal(matchDistrict(`  ${district.toUpperCase()} `), district);
    }
  });

  it('understands older and alternative spellings', () => {
    assert.equal(matchDistrict('Chittagong'), 'Chattogram');
    assert.equal(matchDistrict('comilla'), 'Cumilla');
    assert.equal(matchDistrict('Jessore'), 'Jashore');
    assert.equal(matchDistrict('Bogra'), 'Bogura');
    assert.equal(matchDistrict('Barisal'), 'Barishal');
    assert.equal(matchDistrict('coxs bazar'), "Cox's Bazar");
    assert.equal(matchDistrict("Cox's-Bazar"), "Cox's Bazar");
    assert.equal(matchDistrict('Cox Bazar'), "Cox's Bazar");
    assert.equal(matchDistrict('Sirajgonj'), 'Sirajganj');
    assert.equal(matchDistrict('Narayangonj'), 'Narayanganj');
    assert.equal(matchDistrict('Chapai Nawabganj'), 'Chapainawabganj');
    assert.equal(matchDistrict('Netrakona'), 'Netrokona');
  });

  it('returns nothing for text that is not a district, so the customer is asked to choose', () => {
    for (const value of ['', '   ', 'Mirpur', 'Dhaka City', 'Ishwardi', 'Bangladesh', null, undefined]) {
      assert.equal(matchDistrict(value), '', JSON.stringify(value));
    }
  });
});
