import {
  RefundManager,
} from '@/components/refund-manager';

import {
  getRefunds,
} from '@/lib/api';

export default async function RefundsPage() {
  const refunds =
    await getRefunds();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Finance
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Refunds
      </h1>

      {refunds.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[#d8cde1] bg-white p-12 text-center text-[#6f6679]">
          No refunds created.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f2edf8]">
              <tr>
                <th className="px-5 py-4">
                  Refund
                </th>

                <th className="px-5 py-4">
                  Return
                </th>

                <th className="px-5 py-4">
                  Order
                </th>

                <th className="px-5 py-4">
                  Amount
                </th>

                <th className="px-5 py-4">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {refunds.map(
                (refund: any) => (
                  <tr
                    key={refund._id}
                    className="border-t border-[#e8e2ef]"
                  >
                    <td className="px-5 py-4 font-bold">
                      {
                        refund.refundNumber
                      }
                    </td>

                    <td className="px-5 py-4">
                      {
                        refund.returnNumber
                      }
                    </td>

                    <td className="px-5 py-4">
                      {
                        refund.orderNumber
                      }
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      ৳{refund.amount}
                    </td>

                    <td className="px-5 py-4">
                      <RefundManager
                        refundNumber={
                          refund.refundNumber
                        }
                        initialStatus={
                          refund.status
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
