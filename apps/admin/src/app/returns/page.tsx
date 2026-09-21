import {
  ReturnStatusManager,
} from '@/components/return-status-manager';

import {
  getReturns,
} from '@/lib/api';

export default async function ReturnsPage() {
  const returns =
    await getReturns();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        After sales
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Returns
      </h1>

      {returns.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[#d8cde1] bg-white p-12 text-center text-[#6f6679]">
          No return requests.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f2edf8]">
              <tr>
                <th className="px-5 py-4">
                  Return
                </th>

                <th className="px-5 py-4">
                  Order
                </th>

                <th className="px-5 py-4">
                  Reason
                </th>

                <th className="px-5 py-4">
                  Refund
                </th>

                <th className="px-5 py-4">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {returns.map(
                (item: any) => (
                  <tr
                    key={item._id}
                    className="border-t border-[#e8e2ef]"
                  >
                    <td className="px-5 py-4 font-bold">
                      {
                        item.returnNumber
                      }
                    </td>

                    <td className="px-5 py-4">
                      {
                        item.orderNumber
                      }
                    </td>

                    <td className="px-5 py-4">
                      {item.reason}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      ৳{
                        item.refundAmount
                      }
                    </td>

                    <td className="px-5 py-4">
                      <ReturnStatusManager
                        returnNumber={
                          item.returnNumber
                        }
                        initialStatus={
                          item.status
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
