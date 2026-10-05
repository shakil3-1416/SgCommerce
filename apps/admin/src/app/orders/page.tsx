import {
  Fragment,
} from 'react';

import {
  OrderStatusManager,
} from '@/components/order-status-manager';

import {
  getOrders,
} from '@/lib/api';

/*
 * Times are shown in Bangladesh time, whichever region the server
 * runs in.
 */
const dhakaTime =
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  });

function when(value: unknown): string {
  const date =
    new Date(String(value ?? ''));

  return Number.isNaN(date.getTime())
    ? ''
    : dhakaTime.format(date);
}

function label(value: unknown): string {
  const text = String(value ?? '');

  return text
    ? text.charAt(0).toUpperCase() +
        text.slice(1)
    : '';
}

const zoneLabels: Record<string, string> = {
  inside_dhaka: 'Inside Dhaka',
  outside_dhaka: 'Outside Dhaka',
};

/* Who made a change, as stored in the order's status history. */
function who(changedBy: unknown): string {
  if (changedBy === 'guest') {
    return 'Customer (guest checkout)';
  }

  if (changedBy === 'customer') {
    return 'Customer (signed in)';
  }

  if (!changedBy || changedBy === 'admin') {
    return 'Admin';
  }

  return String(changedBy);
}

const sectionHeading =
  'text-xs font-bold uppercase tracking-[0.12em] text-[#6f6679]';

export default async function OrdersPage() {
  const orders =
    await getOrders();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Operations
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Orders
      </h1>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[#d8cde1] bg-white p-12 text-center text-[#6f6679]">
          No orders yet.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white">
          {/*
           * A normal table from 640px up. On phones every order
           * becomes a stacked block, so the status control and the
           * details are not cut off at the edge of the screen.
           */}
          <table className="block w-full text-left text-sm sm:table">
            <thead className="hidden bg-[#f2edf8] text-[#1f1235] sm:table-header-group">
              <tr>
                <th className="px-5 py-4">
                  Order
                </th>

                <th className="px-5 py-4">
                  Customer
                </th>

                <th className="px-5 py-4">
                  Total
                </th>

                <th className="px-5 py-4">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="block sm:table-row-group">
              {orders.map(
                (order: any) => (
                  <Fragment key={order._id}>
                  <tr
                    className="block border-t border-[#e8e2ef] px-5 py-3 sm:table-row sm:p-0"
                  >
                    <td className="block py-1.5 sm:table-cell sm:px-5 sm:py-4">
                      <p className="font-bold text-[#1f1235]">
                        {
                          order.orderNumber
                        }
                      </p>

                      <p className="mt-1 text-xs text-[#6f6679]">
                        {
                          order.items
                            .length
                        }{' '}
                        item(s)
                      </p>

                      {when(order.createdAt) && (
                        <p className="mt-1 text-xs text-[#6f6679]">
                          {when(order.createdAt)}
                        </p>
                      )}
                    </td>

                    <td className="block py-1.5 sm:table-cell sm:px-5 sm:py-4">
                      <p className="font-semibold">
                        {
                          order.customer
                            .name
                        }
                      </p>

                      <p className="text-xs text-[#6f6679]">
                        {
                          order.customer
                            .phone
                        }
                      </p>
                    </td>

                    <td className="block py-1.5 font-semibold sm:table-cell sm:px-5 sm:py-4">
                      <span className="font-normal text-[#6f6679] sm:hidden">
                        Total{' '}
                      </span>
                      ৳{order.total}
                    </td>

                    <td className="block py-1.5 sm:table-cell sm:px-5 sm:py-4">
                      <OrderStatusManager
                        orderNumber={
                          order.orderNumber
                        }
                        initialStatus={
                          order.status
                        }
                        initialTrackingNumber={
                          order.trackingNumber ?? ''
                        }
                      />
                    </td>
                  </tr>

                  {/*
                   * Everything stored for the order: what to pack,
                   * where to deliver it, what to collect, and who
                   * changed its status and when.
                   */}
                  <tr className="block sm:table-row">
                    <td
                      colSpan={4}
                      className="block px-5 pb-4 sm:table-cell"
                    >
                      <details className="rounded-xl bg-[#faf8fc] px-4 py-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#38205f]">
                          Order details
                        </summary>

                        <div className="mt-4 grid gap-6 lg:grid-cols-3">
                          <section className="lg:col-span-2">
                            <h2 className={sectionHeading}>
                              Items
                            </h2>

                            <ul className="mt-2 divide-y divide-[#e8e2ef]">
                              {(order.items ?? []).map(
                                (item: any) => (
                                  <li
                                    key={item.sku}
                                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                                  >
                                    <div>
                                      <p className="font-semibold text-[#1f1235]">
                                        {item.productName}
                                      </p>

                                      <p className="text-xs text-[#6f6679]">
                                        {[
                                          item.productCode,
                                          item.sku,
                                          item.variantTitle,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </p>
                                    </div>

                                    <p>
                                      {item.quantity} × ৳{item.unitPrice} ={' '}
                                      <span className="font-semibold">
                                        ৳{item.lineTotal}
                                      </span>
                                    </p>
                                  </li>
                                ),
                              )}
                            </ul>

                            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-[#e8e2ef] pt-3">
                              <dt className="text-[#6f6679]">
                                Subtotal
                              </dt>
                              <dd className="text-right">
                                ৳{order.subtotal}
                              </dd>

                              <dt className="text-[#6f6679]">
                                Delivery
                              </dt>
                              <dd className="text-right">
                                ৳{order.shippingFee}
                              </dd>

                              <dt className="font-semibold">
                                Total to collect
                              </dt>
                              <dd className="text-right font-semibold">
                                ৳{order.total}
                              </dd>
                            </dl>
                          </section>

                          <section>
                            <h2 className={sectionHeading}>
                              Deliver to
                            </h2>

                            <address className="mt-2 not-italic leading-6">
                              <span className="font-semibold">
                                {order.customer?.name}
                              </span>
                              <br />
                              {order.customer?.phone}
                              {order.customer?.email && (
                                <>
                                  <br />
                                  {order.customer.email}
                                </>
                              )}
                              <br />
                              {[
                                order.shippingAddress?.addressLine1,
                                order.shippingAddress?.addressLine2,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                              <br />
                              {[
                                order.shippingAddress?.area,
                                order.shippingAddress?.city,
                                order.shippingAddress?.postalCode,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                              <br />
                              {zoneLabels[
                                order.shippingAddress?.zone
                              ] ??
                                order.shippingAddress?.zone}
                            </address>

                            <h2 className={`mt-4 ${sectionHeading}`}>
                              Payment
                            </h2>

                            <p className="mt-2">
                              {order.paymentMethod === 'cod'
                                ? 'Cash on delivery'
                                : order.paymentMethod}
                              {' · '}
                              {label(order.paymentStatus)}
                            </p>
                          </section>

                          <section className="lg:col-span-3">
                            <h2 className={sectionHeading}>
                              History
                            </h2>

                            {(order.statusHistory ?? []).length === 0 ? (
                              <p className="mt-2 text-[#6f6679]">
                                No history was recorded for this order. It was placed before history was kept.
                              </p>
                            ) : (
                              <ol className="mt-2 space-y-1">
                                {order.statusHistory.map(
                                  (
                                    entry: any,
                                    index: number,
                                  ) => (
                                    <li
                                      key={index}
                                      className="flex flex-wrap gap-x-3"
                                    >
                                      <span className="font-semibold">
                                        {label(entry.status)}
                                      </span>

                                      <span>
                                        Payment {entry.paymentStatus}
                                      </span>

                                      {entry.trackingNumber && (
                                        <span>
                                          Tracking {entry.trackingNumber}
                                        </span>
                                      )}

                                      <span className="text-[#6f6679]">
                                        {who(entry.changedBy)}
                                        {' · '}
                                        {when(entry.at)}
                                      </span>
                                    </li>
                                  ),
                                )}
                              </ol>
                            )}
                          </section>
                        </div>
                      </details>
                    </td>
                  </tr>
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
