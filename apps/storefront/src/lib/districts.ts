/**
 * Districts of Bangladesh and the delivery charge that follows from them.
 *
 * The customer picks a district; the delivery zone and charge are worked
 * out from it. The API applies the same rule again on its side and
 * ignores any zone a browser sends, so the two can never disagree about
 * what is charged.
 */

/** The 64 districts, in alphabetical order, with their current official spellings. */
export const DISTRICTS = [
  'Bagerhat',
  'Bandarban',
  'Barguna',
  'Barishal',
  'Bhola',
  'Bogura',
  'Brahmanbaria',
  'Chandpur',
  'Chapainawabganj',
  'Chattogram',
  'Chuadanga',
  "Cox's Bazar",
  'Cumilla',
  'Dhaka',
  'Dinajpur',
  'Faridpur',
  'Feni',
  'Gaibandha',
  'Gazipur',
  'Gopalganj',
  'Habiganj',
  'Jamalpur',
  'Jashore',
  'Jhalokati',
  'Jhenaidah',
  'Joypurhat',
  'Khagrachhari',
  'Khulna',
  'Kishoreganj',
  'Kurigram',
  'Kushtia',
  'Lakshmipur',
  'Lalmonirhat',
  'Madaripur',
  'Magura',
  'Manikganj',
  'Meherpur',
  'Moulvibazar',
  'Munshiganj',
  'Mymensingh',
  'Naogaon',
  'Narail',
  'Narayanganj',
  'Narsingdi',
  'Natore',
  'Netrokona',
  'Nilphamari',
  'Noakhali',
  'Pabna',
  'Panchagarh',
  'Patuakhali',
  'Pirojpur',
  'Rajbari',
  'Rajshahi',
  'Rangamati',
  'Rangpur',
  'Satkhira',
  'Shariatpur',
  'Sherpur',
  'Sirajganj',
  'Sunamganj',
  'Sylhet',
  'Tangail',
  'Thakurgaon',
] as const;

export type District = (typeof DISTRICTS)[number];

export type DeliveryZone = 'inside_dhaka' | 'outside_dhaka';

/** Must match `shippingFee` in apps/api/src/modules/orders/orders.service.ts. */
export const DELIVERY_FEE: Record<DeliveryZone, number> = {
  inside_dhaka: 80,
  outside_dhaka: 150,
};

export const ZONE_LABEL: Record<DeliveryZone, string> = {
  inside_dhaka: 'Inside Dhaka',
  outside_dhaka: 'Outside Dhaka',
};

/** Must match `deliveryZoneFor` in apps/api/src/common/delivery-zone.ts. */
export function deliveryZoneFor(district: string): DeliveryZone {
  return district.trim().toLowerCase() === 'dhaka' ? 'inside_dhaka' : 'outside_dhaka';
}

/* Older and common alternative spellings, for addresses saved before the district list existed. */
const OTHER_SPELLINGS: Record<string, District> = {
  barisal: 'Barishal',
  bogra: 'Bogura',
  chittagong: 'Chattogram',
  comilla: 'Cumilla',
  jessore: 'Jashore',
  coxbazar: "Cox's Bazar",
  chapainababganj: 'Chapainawabganj',
  jhalakathi: 'Jhalokati',
  jhalokathi: 'Jhalokati',
  jhalakati: 'Jhalokati',
  jhenaidaha: 'Jhenaidah',
  jhinaidah: 'Jhenaidah',
  khagrachari: 'Khagrachhari',
  laxmipur: 'Lakshmipur',
  maulvibazar: 'Moulvibazar',
  moulovibazar: 'Moulvibazar',
  netrakona: 'Netrokona',
  narshingdi: 'Narsingdi',
  panchagar: 'Panchagarh',
  thakurgao: 'Thakurgaon',
};

/** "Cox's Bazar", "coxs bazar" and "COXS-BAZAR" all become "coxsbazar". */
function key(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/gonj/g, 'ganj');
}

const BY_KEY = new Map<string, District>([
  ...DISTRICTS.map((district) => [key(district), district] as [string, District]),
  ...Object.entries(OTHER_SPELLINGS),
]);

/**
 * The district a free-text city refers to, or '' when it is not a
 * district. Used to pre-select the district for a saved address; when
 * nothing matches, the customer is asked to choose.
 */
export function matchDistrict(value: string | null | undefined): District | '' {
  return BY_KEY.get(key(value ?? '')) ?? '';
}
