import {
  OrderStatusManager,
} from '@/components/order-status-manager';

import {
  getOrders,
} from '@/lib/api';

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
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f2edf8] text-[#1f1235]">
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

            <tbody>
              {orders.map(
                (order: any) => (
                  <tr
                    key={order._id}
                    className="border-t border-[#e8e2ef]"
                  >
                    <td className="px-5 py-4">
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
                    </td>

                    <td className="px-5 py-4">
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

                    <td className="px-5 py-4 font-semibold">
                      ৳{order.total}
                    </td>

                    <td className="px-5 py-4">
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
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
