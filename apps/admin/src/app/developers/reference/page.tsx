import {
  Badge,
  CopyButton,
} from '@/components/developer-ui';

import {
  developerApiUrl,
  getDeveloperReference,
} from '@/lib/api';

import {
  type ScopeOption,
  snippets,
} from '@/lib/developer-applications';

interface Endpoint {
  group: string;
  method: string;
  path: string;
  scope: string | null;
  summary: string;
  filters: string[];
  paged: boolean;
}

const card =
  'rounded-2xl border border-[#e8e2ef] bg-white p-6';

const heading =
  'text-xl font-bold text-[#1f1235]';

/*
 * The API's reference, drawn from the API's own description of itself
 * (GET /developer-applications/reference), so it always matches the
 * version that is running.
 */
export default async function DeveloperReferencePage() {
  const reference =
    await getDeveloperReference();

  const apiUrl = developerApiUrl();

  const endpoints: Endpoint[] =
    reference.endpoints ?? [];

  const groups = [
    ...new Set(endpoints.map((endpoint) => endpoint.group)),
  ];

  const scopes: ScopeOption[] =
    reference.scopes ?? [];

  return (
    <div className="mt-8 space-y-6">
      <section className={card}>
        <h2 className={heading}>
          Quick start
        </h2>

        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#4f455c]">
          <li>
            Create an application under Applications and copy its
            key.
          </li>
          <li>
            Send the key with every request in the Authorization
            header.
          </li>
          <li>
            Read <code className="font-mono">data</code> from the
            answer. For a list, pass{' '}
            <code className="font-mono">pagination.next_cursor</code>{' '}
            back as <code className="font-mono">cursor</code> to get
            the next page.
          </li>
        </ol>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {snippets(apiUrl).map((snippet) => (
            <div
              key={snippet.language}
              className="min-w-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#1f1235]">
                  {snippet.language}
                </p>

                <CopyButton text={snippet.code} />
              </div>

              <pre className="mt-2 overflow-x-auto rounded-xl bg-[#1f1235] px-4 py-3 text-xs leading-5 text-white">
                {snippet.code}
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>
          Basics
        </h2>

        <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[#1f1235]">
              Base address
            </dt>
            <dd className="mt-1 break-all font-mono text-[#4f455c]">
              {apiUrl}
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[#1f1235]">
              Authentication
            </dt>
            <dd className="mt-1 font-mono text-[#4f455c]">
              Authorization: Bearer sg_live_...
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[#1f1235]">
              Answers
            </dt>
            <dd className="mt-1 text-[#4f455c]">
              One record:{' '}
              <code className="font-mono">{'{ "data": {...} }'}</code>
              . A list:{' '}
              <code className="font-mono">
                {'{ "data": [...], "pagination": {...} }'}
              </code>
              . Field names are snake_case; times are ISO 8601 in
              UTC; money is whole BDT.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[#1f1235]">
              Lists
            </dt>
            <dd className="mt-1 text-[#4f455c]">
              Newest first.{' '}
              <code className="font-mono">limit</code> from 1 to{' '}
              {reference.pagination.maximumLimit} (default{' '}
              {reference.pagination.defaultLimit});{' '}
              <code className="font-mono">cursor</code> is the{' '}
              <code className="font-mono">next_cursor</code> of the
              previous page.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[#1f1235]">
              Rate limit
            </dt>
            <dd className="mt-1 text-[#4f455c]">
              {reference.rateLimit.requests} requests per{' '}
              {reference.rateLimit.perSeconds} seconds for each
              application. See the RateLimit-Limit,
              RateLimit-Remaining and RateLimit-Reset headers; a 429
              carries Retry-After.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[#1f1235]">
              Request IDs
            </dt>
            <dd className="mt-1 text-[#4f455c]">
              Every answer has an X-Request-ID header. Search for it
              under Requests to see what happened.
            </dd>
          </div>
        </dl>
      </section>

      <section className={card}>
        <h2 className={heading}>
          Endpoints
        </h2>

        <p className="mt-1 text-sm text-[#6f6679]">
          Paths are relative to the base address. Version{' '}
          {reference.version}.
        </p>

        <div className="mt-5 space-y-6">
          {groups.map((group) => (
            <div key={group}>
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#6f6679]">
                {group}
              </h3>

              <ul className="mt-2 divide-y divide-[#f0ebf5] rounded-xl border border-[#f0ebf5]">
                {endpoints
                  .filter((endpoint) => endpoint.group === group)
                  .map((endpoint) => (
                    <li
                      key={endpoint.path}
                      className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_auto] lg:items-start"
                    >
                      <span className="break-all font-mono text-[#1f1235]">
                        <span className="mr-2 rounded bg-[#f2edf8] px-1.5 py-0.5 text-xs font-bold text-[#38205f]">
                          {endpoint.method}
                        </span>{' '}
                        {endpoint.path || '/'}
                      </span>

                      <span className="text-[#4f455c]">
                        {endpoint.summary}

                        {endpoint.filters.length > 0 && (
                          <span className="mt-1 block font-mono text-xs text-[#6f6679]">
                            Filters: {endpoint.filters.join(', ')}
                          </span>
                        )}

                        {endpoint.paged && (
                          <span className="mt-1 block text-xs text-[#6f6679]">
                            Paged: limit, cursor
                          </span>
                        )}
                      </span>

                      <span className="font-mono text-xs text-[#38205f]">
                        {endpoint.scope ?? 'any valid key'}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>
          Permissions
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-[#6f6679]">
              <tr>
                <th className="py-2 pr-4 font-semibold">
                  Scope
                </th>
                <th className="py-2 pr-4 font-semibold">
                  Allows
                </th>
                <th className="py-2 font-semibold">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {scopes.map((scope) => (
                <tr
                  key={scope.scope}
                  className="border-t border-[#f0ebf5]"
                >
                  <td className="py-2 pr-4 font-mono text-[#1f1235]">
                    {scope.scope}
                  </td>

                  <td className="py-2 pr-4 text-[#4f455c]">
                    {scope.allows}
                  </td>

                  <td className="py-2">
                    <Badge
                      tone={
                        scope.available
                          ? 'good'
                          : 'muted'
                      }
                    >
                      {scope.available
                        ? 'Available'
                        : 'Planned'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>
          Errors
        </h2>

        <p className="mt-1 text-sm text-[#6f6679]">
          An error has one shape:{' '}
          <code className="font-mono">
            {'{ "error": { "code", "message", "request_id" } }'}
          </code>
          . Read <code className="font-mono">code</code> in a
          program; the message is for a person.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-[#6f6679]">
              <tr>
                <th className="py-2 pr-4 font-semibold">
                  Status
                </th>
                <th className="py-2 pr-4 font-semibold">
                  Code
                </th>
                <th className="py-2 font-semibold">
                  Meaning
                </th>
              </tr>
            </thead>

            <tbody>
              {(reference.errors ?? []).map(
                (error: {
                  status: number;
                  code: string;
                  meaning: string;
                }) => (
                  <tr
                    key={error.code}
                    className="border-t border-[#f0ebf5]"
                  >
                    <td className="py-2 pr-4 text-[#4f455c]">
                      {error.status}
                    </td>

                    <td className="py-2 pr-4 font-mono text-[#1f1235]">
                      {error.code}
                    </td>

                    <td className="py-2 text-[#4f455c]">
                      {error.meaning}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-[#6f6679]">
        The full guide, with example answers for every resource and
        the versioning policy, is in docs/DEVELOPER_API.md in the
        project.
      </p>
    </div>
  );
}
