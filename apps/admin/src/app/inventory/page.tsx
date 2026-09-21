import {
  InventoryAdjuster,
} from '@/components/inventory-adjuster';

import {
  getInventory,
} from '@/lib/api';

export default async function InventoryPage() {
  const data =
    await getInventory();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Operations
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Inventory
      </h1>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f2edf8]">
            <tr>
              <th className="px-5 py-4">
                SKU
              </th>

              <th className="px-5 py-4">
                Product
              </th>

              <th className="px-5 py-4">
                On hand
              </th>

              <th className="px-5 py-4">
                Available
              </th>

              <th className="px-5 py-4">
                Adjust
              </th>
            </tr>
          </thead>

          <tbody>
            {data.items.map(
              (item: any) => (
                <tr
                  key={item.sku}
                  className="border-t border-[#e8e2ef]"
                >
                  <td className="px-5 py-4 font-bold">
                    {item.sku}
                  </td>

                  <td className="px-5 py-4">
                    {
                      item.productName
                    }

                    <div className="text-xs text-[#6f6679]">
                      {
                        item.variantTitle
                      }
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {item.onHand}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={
                        item.lowStock
                          ? 'font-bold text-amber-600'
                          : 'text-emerald-700'
                      }
                    >
                      {
                        item.available
                      }
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <InventoryAdjuster
                      sku={
                        item.sku
                      }
                    />
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
