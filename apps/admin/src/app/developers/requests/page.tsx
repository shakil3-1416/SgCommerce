import Link from 'next/link';

import {
  Badge,
} from '@/components/developer-ui';

import {
  getDeveloperOverview,
  getDeveloperRequests,
} from '@/lib/api';

import {
  type ApplicationSummary,
  type RequestLine,
  requestsLink,
  statusTone,
  when,
} from '@/lib/developer-applications';

type Search = Promise<
  Record<string, string | string[] | undefined>
>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: '2xx', label: 'Succeeded (2xx)' },
  { value: '4xx', label: 'Refused (4xx)' },
  { value: '5xx', label: 'Failed (5xx)' },
];

/*
 * The request log: what each application asked for and how it was
 * answered. Filtering is done with an ordinary form, so a filtered view
 * has an address that can be bookmarked or sent to a colleague.
 */
export default async function DeveloperRequestsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const search = await searchParams;

  const appId = one(search.app_id).trim();
  const status = one(search.status).trim();
  const requestId = one(search.request_id).trim();
  const cursor = one(search.cursor).trim();

  const query = new URLSearchParams({ limit: '50' });

  if (appId) query.set('app_id', appId);
  if (['2xx', '4xx', '5xx'].includes(status)) query.set('status', status);
  if (requestId) query.set('request_id', requestId);
  if (cursor) query.set('cursor', cursor);

  const [overview, log] = await Promise.all([
    getDeveloperOverview(),
    getDeveloperRequests(query),
  ]);

  const applications: ApplicationSummary[] =
    overview.applications ?? [];

  const requests: RequestLine[] =
    log.requests ?? [];

  const filtered =
    appId !== '' || status !== '' || requestId !== '';

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1f1235]">
          Requests
        </h2>

        <p className="mt-1 max-w-3xl text-sm text-[#6f6679]">
          Every request an application makes, newest first. To look
          into a problem, search for the request ID from the
          response&apos;s X-Request-ID header or its error. Query
          strings and keys are never recorded. The most recent
          200,000 requests are kept.
        </p>
      </div>

      <form
        method="get"
        action="/developers/requests"
        className="grid gap-4 rounded-2xl border border-[#e8e2ef] bg-white p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <label className="block">
          <span className="text-xs font-semibold text-[#1f1235]">
            Application
          </span>

          <select
            name="app_id"
            defaultValue={appId}
            className="mt-1 w-full rounded-xl border border-[#e8e2ef] bg-white px-3 py-2.5 text-sm"
          >
            <option value="">
              All applications
            </option>

            {applications.map((application) => (
              <option
                key={application.id}
                value={application.id}
              >
                {application.name}
                {application.status === 'revoked'
                  ? ' (revoked)'
                  : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[#1f1235]">
            Status
          </span>

          <select
            name="status"
            defaultValue={status}
            className="mt-1 w-full rounded-xl border border-[#e8e2ef] bg-white px-3 py-2.5 text-sm"
          >
            {STATUSES.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-[#1f1235]">
            Request ID
          </span>

          <input
            name="request_id"
            defaultValue={requestId}
            placeholder="req_..."
            className="mt-1 w-full rounded-xl border border-[#e8e2ef] px-3 py-2.5 font-mono text-sm"
          />
        </label>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="rounded-xl bg-[#1f1235] px-5 py-2.5 text-sm font-bold text-white"
          >
            Filter
          </button>

          {filtered && (
            <Link
              href="/developers/requests"
              className="py-2.5 text-sm font-semibold text-[#4c2a7d] underline-offset-4 hover:underline"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#d8cee6] bg-white p-8 text-center text-[#6f6679]">
          {filtered
            ? 'No request matches these filters.'
            : 'No requests yet. They appear here as soon as an application calls the API.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e8e2ef] bg-white">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-[#f2edf8] text-xs text-[#4f455c]">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  When
                </th>
                <th className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold">
                  Request
                </th>
                <th className="px-4 py-3 font-semibold">
                  Application
                </th>
                <th className="px-4 py-3 font-semibold">
                  Time
                </th>
                <th className="px-4 py-3 font-semibold">
                  Request ID
                </th>
              </tr>
            </thead>

            <tbody>
              {requests.map((line) => (
                <tr
                  key={line.requestId}
                  className="border-t border-[#f0ebf5] align-top"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[#4f455c]">
                    {when(line.at)}
                  </td>

                  <td className="px-4 py-3">
                    <Badge tone={statusTone(line.status)}>
                      {line.status}
                    </Badge>
                  </td>

                  <td className="px-4 py-3">
                    <span className="break-all font-mono text-xs text-[#1f1235]">
                      {line.method} {line.path}
                    </span>

                    {line.code && (
                      <span className="block font-mono text-xs text-[#6f6679]">
                        {line.code}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/developers/${encodeURIComponent(line.appId)}`}
                      className="font-semibold text-[#38205f] underline-offset-4 hover:underline"
                    >
                      {line.appName || line.appId}
                    </Link>

                    {line.ip && (
                      <span className="block font-mono text-xs text-[#6f6679]">
                        {line.ip}
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[#4f455c]">
                    {line.durationMs} ms
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-[#4f455c]">
                    {line.requestId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.hasMore && log.nextCursor && (
        <p>
          <Link
            href={requestsLink({
              appId,
              status,
              requestId,
              cursor: log.nextCursor,
            })}
            className="rounded-xl border border-[#d8cee6] bg-white px-5 py-2.5 text-sm font-semibold text-[#38205f]"
          >
            Older requests
          </Link>
        </p>
      )}
    </div>
  );
}
