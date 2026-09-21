import {
  getCustomers,
} from '@/lib/api';

export default async function CustomersPage() {
  const customers =
    await getCustomers();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        CRM
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Customers
      </h1>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f2edf8]">
            <tr>
              <th className="px-5 py-4">
                Name
              </th>

              <th className="px-5 py-4">
                Phone
              </th>

              <th className="px-5 py-4">
                Email
              </th>
            </tr>
          </thead>

          <tbody>
            {customers.map(
              (customer: any) => (
                <tr
                  key={customer._id}
                  className="border-t border-[#e8e2ef]"
                >
                  <td className="px-5 py-4 font-semibold">
                    {customer.name}
                  </td>

                  <td className="px-5 py-4">
                    {customer.phone}
                  </td>

                  <td className="px-5 py-4 text-[#6f6679]">
                    {customer.email ||
                      '—'}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
