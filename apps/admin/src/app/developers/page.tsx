import {
  DeveloperApplications,
} from '@/components/developer-applications';

import {
  getDeveloperOverview,
} from '@/lib/api';

/*
 * The address outside programs call. It is the API's public address
 * with /developer added.
 */
const DEVELOPER_API_URL = `${(
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  'http://localhost:4000/api/v1'
).replace(/\/+$/, '')}/developer`;

export default async function DevelopersPage() {
  const overview =
    await getDeveloperOverview();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Platform
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Developers
      </h1>

      <p className="mt-3 max-w-3xl text-[#6f6679]">
        Let another system read your shop&apos;s data: an ERP, a courier
        service, an accounting tool. Each system gets its own
        application with its own key and only the permissions you
        choose, and you can switch any one of them off without
        affecting the others. Never give a system your admin password.
      </p>

      <dl className="mt-6 grid max-w-3xl gap-x-6 gap-y-2 rounded-2xl border border-[#e8e2ef] bg-white p-5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-[#1f1235]">
          API address
        </dt>
        <dd className="break-all font-mono text-[#38205f]">
          {DEVELOPER_API_URL}
        </dd>

        <dt className="font-semibold text-[#1f1235]">
          Environment
        </dt>
        <dd className="text-[#4f455c]">
          {overview.environment === 'test'
            ? 'Test (sandbox data; keys start with sg_test_)'
            : 'Live (your real shop; keys start with sg_live_)'}
        </dd>

        <dt className="font-semibold text-[#1f1235]">
          Documentation
        </dt>
        <dd className="text-[#4f455c]">
          docs/DEVELOPER_API.md in the project
        </dd>
      </dl>

      <DeveloperApplications
        initialApplications={overview.applications ?? []}
        scopes={overview.scopes ?? []}
        apiUrl={DEVELOPER_API_URL}
      />
    </main>
  );
}
