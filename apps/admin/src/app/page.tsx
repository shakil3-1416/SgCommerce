const modules = [
  {
    title: 'Products',
    description: 'Manage catalog, variants and pricing.',
  },
  {
    title: 'Inventory',
    description: 'Manage SKU stock and availability.',
  },
  {
    title: 'Orders',
    description: 'Process and fulfill customer orders.',
  },
  {
    title: 'Customers',
    description: 'View customer profiles and order history.',
  },
  {
    title: 'Payments',
    description: 'Review payment activity and status.',
  },
  {
    title: 'Shipping',
    description: 'Manage fulfillment and tracking.',
  },
  {
    title: 'Returns',
    description: 'Review customer return requests.',
  },
  {
    title: 'Refunds',
    description: 'Manage approved refunds.',
  },
];

export default function AdminHome() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[#e8e2ef] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div>
            <span className="text-xl font-bold tracking-tight text-[#1f1235]">
              SgCommerce
            </span>

            <span className="ml-3 rounded-full bg-[#f2edf8] px-3 py-1 text-xs font-semibold text-[#38205f]">
              Admin
            </span>
          </div>

          <span className="text-sm text-[#6f6679]">
            Merchant Console
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="rounded-3xl bg-[#1f1235] px-8 py-10 text-white lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-200">
            Operations
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Merchant Dashboard
          </h1>

          <p className="mt-4 max-w-2xl text-purple-100">
            Manage the complete SgCommerce business from catalog
            through fulfillment and after-sales service.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#e8e2ef] bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2edf8] font-bold text-[#29164a]">
                {item.title.charAt(0)}
              </div>

              <h2 className="font-semibold text-[#1f1235]">
                {item.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#6f6679]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
