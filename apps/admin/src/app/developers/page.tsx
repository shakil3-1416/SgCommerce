import {
  DeveloperApplications,
} from '@/components/developer-applications';

import {
  CopyButton,
} from '@/components/developer-ui';

import {
  developerApiUrl,
  getDeveloperOverview,
} from '@/lib/api';

export default async function DevelopersPage() {
  const overview =
    await getDeveloperOverview();

  const apiUrl = developerApiUrl();

  return (
    <>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#e8e2ef] bg-white p-5 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6f6679]">
            API address
          </dt>

          <dd className="mt-2 flex flex-wrap items-center gap-3">
            <span className="break-all font-mono text-sm text-[#1f1235]">
              {apiUrl}
            </span>

            <CopyButton text={apiUrl} />
          </dd>
        </div>

        <div className="rounded-2xl border border-[#e8e2ef] bg-white p-5">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6f6679]">
            Environment
          </dt>

          <dd className="mt-2 text-sm text-[#1f1235]">
            <span className="font-semibold">
              {overview.environment === 'test'
                ? 'Test'
                : 'Live'}
            </span>
            {' · '}
            version {overview.apiVersion}

            <span className="mt-1 block text-xs text-[#6f6679]">
              {overview.environment === 'test'
                ? 'Sandbox data. Keys start with sg_test_'
                : 'Your real shop. Keys start with sg_live_'}
            </span>
          </dd>
        </div>

        <div className="rounded-2xl border border-[#e8e2ef] bg-white p-5">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6f6679]">
            Rate limit
          </dt>

          <dd className="mt-2 text-sm text-[#1f1235]">
            <span className="font-semibold">
              {overview.rateLimit.requests}
            </span>{' '}
            requests per minute

            <span className="mt-1 block text-xs text-[#6f6679]">
              For each application
            </span>
          </dd>
        </div>
      </dl>

      <DeveloperApplications
        initialApplications={overview.applications ?? []}
        scopes={overview.scopes ?? []}
        expiryChoices={overview.expiryChoices ?? [0]}
        maximumApplications={overview.maximumApplications ?? 25}
        apiUrl={apiUrl}
      />
    </>
  );
}
