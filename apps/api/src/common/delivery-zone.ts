/**
 * Which delivery charge an address gets.
 *
 * The zone is decided here, on the server, from the district the customer
 * chose. Whatever zone a browser sends is ignored, so an address outside
 * Dhaka can no longer be charged the inside-Dhaka rate.
 *
 * Rule: Dhaka district is "inside Dhaka". Every other district, and any
 * value that is not recognised, is "outside Dhaka".
 */
export type DeliveryZone = 'inside_dhaka' | 'outside_dhaka';

const INSIDE_DHAKA = new Set(['dhaka', '\u09a2\u09be\u0995\u09be']);

export function deliveryZoneFor(district: string): DeliveryZone {
  const name = district.trim().toLowerCase();

  return INSIDE_DHAKA.has(name) ? 'inside_dhaka' : 'outside_dhaka';
}
