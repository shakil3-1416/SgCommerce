'use client';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  useState,
} from 'react';

import {
  Badge,
  CopyButton,
  IssuedKey,
  UsageBars,
} from '@/components/developer-ui';

import {
  ScopePicker,
} from '@/components/developer-scope-picker';

import {
  type ApplicationEvent,
  type ApplicationSummary,
  applicationState,
  errorRate,
  eventLabel,
  expiryChoiceLabel,
  graceChoiceLabel,
  type RequestLine,
  requestsLink,
  scopeChanges,
  type ScopeOption,
  reasonFrom,
  statusTone,
  type UsageSummary,
  when,
  writeScopesIn,
} from '@/lib/developer-applications';

const card =
  'rounded-2xl border border-[#e8e2ef] bg-white p-6';

const heading =
  'text-lg font-bold text-[#1f1235]';

const secondary =
  'rounded-lg border border-[#d8cee6] bg-white px-4 py-2 text-sm font-semibold text-[#38205f] disabled:opacity-60';

const primary =
  'rounded-lg bg-[#1f1235] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60';

/**
 * Everything about one API application: what it is, its key, what it
 * may do, what it has been doing, and how it has changed.
 */
export function DeveloperApplicationDetail({
  initialApplication,
  usage,
  recentRequests,
  events,
  scopes,
  expiryChoices,
  rollGraceChoices,
  apiUrl,
}: {
  initialApplication: ApplicationSummary;
  usage: UsageSummary;
  recentRequests: RequestLine[];
  events: ApplicationEvent[];
  scopes: ScopeOption[];
  expiryChoices: number[];
  rollGraceChoices: number[];
  apiUrl: string;
}) {
  const router = useRouter();

  const [application, setApplication] =
    useState(initialApplication);

  const [busy, setBusy] =
    useState(false);

  const [problem, setProblem] =
    useState('');

  const [notice, setNotice] =
    useState('');

  /* Details */
  const [editing, setEditing] =
    useState(false);

  const [name, setName] =
    useState(initialApplication.name);

  const [description, setDescription] =
    useState(initialApplication.description ?? '');

  /* Permissions */
  const [chosen, setChosen] =
    useState<string[]>(initialApplication.scopes);

  /* Key */
  const [rolling, setRolling] =
    useState(false);

  const [graceHours, setGraceHours] =
    useState(rollGraceChoices.includes(24) ? 24 : 0);

  const [expiresInDays, setExpiresInDays] =
    useState(0);

  const [issued, setIssued] =
    useState<string | null>(null);

  /* Revoke */
  const [confirmName, setConfirmName] =
    useState('');

  const active = application.status === 'active';
  const state = applicationState(application);
  const changes = scopeChanges(application.scopes, chosen);

  const scopesChanged =
    changes.added.length > 0 || changes.removed.length > 0;

  const base = `/api/backend/developer-applications/${encodeURIComponent(application.id)}`;

  async function send(
    path: string,
    method: 'PATCH' | 'POST',
    body: unknown,
    done: (answer: any) => void,
  ) {
    if (busy) {
      return;
    }

    setBusy(true);
    setProblem('');
    setNotice('');

    try {
      const response = await fetch(
        `${base}${path}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body ?? {}),
        },
      );

      if (!response.ok) {
        setProblem(await reasonFrom(response));
        return;
      }

      done(await response.json());

      // Usage, history and recent requests are drawn by the server.
      router.refresh();
    } catch {
      setProblem(
        'Check your internet connection, then try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function saveDetails() {
    void send(
      '',
      'PATCH',
      {
        name: name.trim(),
        description: description.trim(),
      },
      (answer) => {
        setApplication(answer);
        setName(answer.name);
        setDescription(answer.description ?? '');
        setEditing(false);
        setNotice('Saved.');
      },
    );
  }

  function savePermissions() {
    const summary = [
      changes.added.length > 0
        ? `Add: ${changes.added.join(', ')}`
        : '',
      changes.removed.length > 0
        ? `Remove: ${changes.removed.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const newWrites = writeScopesIn(
      changes.added,
      scopes,
    );

    const caution =
      newWrites.length > 0
        ? `\n\nThis lets it change your shop's data (${newWrites.map((scope) => scope.scope).join(', ')}). Anyone who has its key can do this.`
        : '';

    if (
      !window.confirm(
        `Change what "${application.name}" may do?\n\n${summary}${caution}\n\nThis takes effect on its next request.`,
      )
    ) {
      return;
    }

    void send(
      '',
      'PATCH',
      { scopes: chosen },
      (answer) => {
        setApplication(answer);
        setChosen(answer.scopes);
        setNotice('Permissions saved.');
      },
    );
  }

  function replaceKey() {
    void send(
      '/roll',
      'POST',
      { graceHours, expiresInDays },
      ({ key, ...answer }) => {
        setApplication(answer);
        setIssued(key);
        setRolling(false);
      },
    );
  }

  function revoke() {
    void send(
      '/revoke',
      'POST',
      {},
      (answer) => {
        setApplication(answer);
        setConfirmName('');
        setIssued(null);
        setNotice('The application is revoked.');
      },
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm">
        <Link
          href="/developers"
          className="font-semibold text-[#4c2a7d] underline-offset-4 hover:underline"
        >
          Applications
        </Link>
        <span className="mx-2 text-[#6f6679]">/</span>
        <span className="text-[#4f455c]">
          {application.name}
        </span>
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words text-3xl font-bold text-[#1f1235]">
            {application.name}
          </h2>

          <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-[#6f6679]">
            <span className="break-all">
              {application.id}
            </span>

            <CopyButton
              text={application.id}
              label="Copy ID"
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={state.tone}>
            {state.label}
          </Badge>

          <Badge tone="muted">
            {application.environment === 'test'
              ? 'Test'
              : 'Live'}
          </Badge>
        </div>
      </header>

      {problem && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {problem}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {notice}
        </p>
      )}

      {issued && (
        <IssuedKey
          name={application.name}
          secret={issued}
          apiUrl={apiUrl}
          note={
            application.previousKey
              ? `The old key keeps working until ${when(application.previousKey.worksUntil)}.`
              : 'The old key no longer works.'
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-label="Details"
          className={card}
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className={heading}>
              Details
            </h3>

            {active && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={secondary}
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Name
                </span>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  maxLength={80}
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Description
                </span>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  maxLength={300}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveDetails}
                  className={primary}
                >
                  Save details
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(application.name);
                    setDescription(application.description ?? '');
                  }}
                  className={secondary}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[#6f6679]">
                  Description
                </dt>
                <dd className="break-words text-[#1f1235]">
                  {application.description || 'None'}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-[#6f6679]">
                  Created
                </dt>
                <dd className="text-[#1f1235]">
                  {when(application.createdAt) || 'Unknown'}
                  {application.createdBy
                    ? ` by ${application.createdBy}`
                    : ''}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-[#6f6679]">
                  Last used
                </dt>
                <dd className="text-[#1f1235]">
                  {when(application.lastUsedAt) || 'Never'}
                </dd>
              </div>

              {!active && (
                <div>
                  <dt className="text-xs text-[#6f6679]">
                    Revoked
                  </dt>
                  <dd className="text-[#1f1235]">
                    {when(application.revokedAt) || 'Yes'}
                    {application.revokedBy
                      ? ` by ${application.revokedBy}`
                      : ''}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section
          aria-label="API key"
          className={card}
        >
          <div className="flex items-start justify-between gap-4">
            <h3 className={heading}>
              API key
            </h3>

            {active && !rolling && (
              <button
                type="button"
                onClick={() => setRolling(true)}
                className={secondary}
              >
                Replace key
              </button>
            )}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-[#6f6679]">
                Current key
              </dt>
              <dd className="break-all font-mono text-[#1f1235]">
                {application.keyHint}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-[#6f6679]">
                Issued
              </dt>
              <dd className="text-[#1f1235]">
                {when(application.keyCreatedAt) || 'Unknown'}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-[#6f6679]">
                Expires
              </dt>
              <dd className="text-[#1f1235]">
                {application.expiresAt
                  ? when(application.expiresAt)
                  : 'Never'}
              </dd>
            </div>
          </dl>

          {application.previousKey && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              The old key{' '}
              <span className="font-mono">
                {application.previousKey.hint}
              </span>{' '}
              still works until{' '}
              {when(application.previousKey.worksUntil)}.
            </p>
          )}

          <p className="mt-4 text-xs text-[#6f6679]">
            The key itself cannot be shown again. If it is lost or
            may have leaked, replace it.
          </p>

          {rolling && (
            <div className="mt-5 space-y-4 rounded-xl border border-[#e8e2ef] bg-[#faf8fc] p-4">
              <p className="text-sm text-[#4f455c]">
                A new key is created and shown once. Choose how
                long the old key keeps working, so the system can
                be switched to the new one without an outage.
              </p>

              <label className="block">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Old key
                </span>

                <select
                  value={graceHours}
                  onChange={(event) =>
                    setGraceHours(
                      Number(event.target.value),
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
                >
                  {rollGraceChoices.map((hours) => (
                    <option
                      key={hours}
                      value={hours}
                    >
                      {graceChoiceLabel(hours)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#1f1235]">
                  New key lifetime
                </span>

                <select
                  value={expiresInDays}
                  onChange={(event) =>
                    setExpiresInDays(
                      Number(event.target.value),
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
                >
                  {expiryChoices.map((days) => (
                    <option
                      key={days}
                      value={days}
                    >
                      {expiryChoiceLabel(days)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={replaceKey}
                  className={primary}
                >
                  Create new key
                </button>

                <button
                  type="button"
                  onClick={() => setRolling(false)}
                  className={secondary}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section
        aria-label="Permissions"
        className={card}
      >
        <h3 className={heading}>
          Permissions
        </h3>

        <p className="mb-4 mt-1 text-sm text-[#6f6679]">
          {active
            ? 'What this application may do. A change takes effect on its next request; the key stays the same.'
            : 'What this application could do before it was revoked.'}
        </p>

        <ScopePicker
          scopes={scopes}
          chosen={chosen}
          onChange={setChosen}
          disabled={!active}
        />

        {active && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                busy ||
                !scopesChanged ||
                chosen.length === 0
              }
              onClick={savePermissions}
              className={primary}
            >
              Save permissions
            </button>

            {scopesChanged && (
              <button
                type="button"
                onClick={() =>
                  setChosen(application.scopes)
                }
                className={secondary}
              >
                Undo changes
              </button>
            )}

            {chosen.length === 0 && (
              <span className="text-sm text-red-700">
                An application needs at least one permission.
                To stop it, revoke it.
              </span>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section
          aria-label="Usage"
          className={card}
        >
          <h3 className={heading}>
            Usage
          </h3>

          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[#6f6679]">
                Today
              </dt>
              <dd className="text-xl font-bold text-[#1f1235]">
                {usage.today.requests}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-[#6f6679]">
                7 days
              </dt>
              <dd className="text-xl font-bold text-[#1f1235]">
                {usage.weekRequests}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-[#6f6679]">
                Errors
              </dt>
              <dd className="text-xl font-bold text-[#1f1235]">
                {errorRate(usage)}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <UsageBars week={usage.week} />
          </div>

          <p className="mt-3 text-xs text-[#6f6679]">
            Requests per day, Bangladesh time.
          </p>
        </section>

        <section
          aria-label="Recent requests"
          className={`${card} min-w-0`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h3 className={heading}>
              Recent requests
            </h3>

            <Link
              href={requestsLink({ appId: application.id })}
              className="text-sm font-semibold text-[#4c2a7d] underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>

          {recentRequests.length === 0 ? (
            <p className="mt-4 text-sm text-[#6f6679]">
              No requests yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs text-[#6f6679]">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">
                      Status
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      Request
                    </th>
                    <th className="py-2 pr-4 font-semibold">
                      Time
                    </th>
                    <th className="py-2 font-semibold">
                      When
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentRequests.map((line) => (
                    <tr
                      key={line.requestId}
                      className="border-t border-[#f0ebf5] align-top"
                    >
                      <td className="py-2 pr-4">
                        <Badge tone={statusTone(line.status)}>
                          {line.status}
                        </Badge>
                      </td>

                      <td className="py-2 pr-4">
                        <span className="break-all font-mono text-xs text-[#1f1235]">
                          {line.method} {line.path}
                        </span>

                        {line.code && (
                          <span className="block font-mono text-xs text-[#6f6679]">
                            {line.code}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap py-2 pr-4 text-[#4f455c]">
                        {line.durationMs} ms
                      </td>

                      <td className="whitespace-nowrap py-2 text-[#4f455c]">
                        {when(line.at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section
        aria-label="History"
        className={card}
      >
        <h3 className={heading}>
          History
        </h3>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-[#6f6679]">
            No changes recorded.
          </p>
        ) : (
          <ol className="mt-4 space-y-3 text-sm">
            {events.map((event, index) => (
              <li
                key={`${event.at}-${index}`}
                className="flex flex-wrap gap-x-3 gap-y-1"
              >
                <span className="font-semibold text-[#1f1235]">
                  {eventLabel(event.action)}
                </span>

                {event.detail && (
                  <span className="break-words text-[#4f455c]">
                    {event.detail}
                  </span>
                )}

                <span className="text-[#6f6679]">
                  {event.actor}
                  {' · '}
                  {when(event.at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {active && (
        <section
          aria-label="Revoke"
          className="rounded-2xl border border-red-200 bg-white p-6"
        >
          <h3 className="text-lg font-bold text-red-800">
            Revoke this application
          </h3>

          <p className="mt-1 text-sm text-[#4f455c]">
            Its key stops working immediately and cannot be
            switched back on. Any system still using it will be
            refused. To give the system a new key instead, use
            Replace key.
          </p>

          <label className="mt-4 block max-w-md">
            <span className="text-sm font-semibold text-[#1f1235]">
              Type the application&apos;s name to confirm
            </span>

            <input
              value={confirmName}
              onChange={(event) =>
                setConfirmName(event.target.value)
              }
              placeholder={application.name}
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <button
            type="button"
            disabled={
              busy ||
              confirmName.trim() !== application.name
            }
            onClick={revoke}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Revoke application
          </button>
        </section>
      )}
    </div>
  );
}
