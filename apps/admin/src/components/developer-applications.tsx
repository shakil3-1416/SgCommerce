'use client';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  FormEvent,
  useState,
} from 'react';

import {
  Badge,
  IssuedKey,
} from '@/components/developer-ui';

import {
  ScopePicker,
} from '@/components/developer-scope-picker';

import {
  type ApplicationSummary,
  applicationState,
  createProblem,
  errorRate,
  expiryChoiceLabel,
  lastUsedLabel,
  reasonFrom,
  type ScopeOption,
  when,
} from '@/lib/developer-applications';

/**
 * The list of API applications, with a form to register a new one.
 *
 * A new application's key is shown once, right after it is created. It
 * is kept only in this page's memory: a reload, or leaving the page,
 * loses it for good, because the server stores only a hash of it.
 */
export function DeveloperApplications({
  initialApplications,
  scopes,
  expiryChoices,
  maximumApplications,
  apiUrl,
}: {
  initialApplications: ApplicationSummary[];
  scopes: ScopeOption[];
  expiryChoices: number[];
  maximumApplications: number;
  apiUrl: string;
}) {
  const router = useRouter();

  const [applications, setApplications] =
    useState(initialApplications);

  const [creating, setCreating] =
    useState(initialApplications.length === 0);

  const [name, setName] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [chosen, setChosen] =
    useState<string[]>([]);

  const [expiresInDays, setExpiresInDays] =
    useState(0);

  const [busy, setBusy] =
    useState(false);

  const [problem, setProblem] =
    useState('');

  // The one and only showing of a new key.
  const [issued, setIssued] =
    useState<{ name: string; key: string } | null>(null);

  const [search, setSearch] =
    useState('');

  const [showRevoked, setShowRevoked] =
    useState(false);

  const active = applications.filter(
    (application) => application.status === 'active',
  );

  const revokedCount =
    applications.length - active.length;

  const needle = search.trim().toLowerCase();

  const visible = applications.filter(
    (application) =>
      (showRevoked || application.status === 'active') &&
      (needle === '' ||
        application.name.toLowerCase().includes(needle) ||
        application.id.toLowerCase().includes(needle) ||
        (application.description ?? '').toLowerCase().includes(needle)),
  );

  async function create(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const invalid = createProblem(name, chosen, description);

    if (invalid) {
      setProblem(invalid);
      return;
    }

    setBusy(true);
    setProblem('');

    try {
      const response = await fetch(
        '/api/backend/developer-applications',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            scopes: chosen,
            expiresInDays,
          }),
        },
      );

      if (!response.ok) {
        setProblem(await reasonFrom(response));
        return;
      }

      const { key, ...application } =
        await response.json();

      setIssued({
        name: application.name,
        key,
      });
      setApplications((current) => [
        application,
        ...current,
      ]);
      setName('');
      setDescription('');
      setChosen([]);
      setExpiresInDays(0);
      setCreating(false);

      // Keep the server-rendered parts of the page in step.
      router.refresh();
    } catch {
      setProblem(
        'Check your internet connection, then try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {issued && (
        <IssuedKey
          name={issued.name}
          secret={issued.key}
          apiUrl={apiUrl}
          note="If it is lost, replace the key on the application's page."
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1f1235]">
            Applications
          </h2>

          <p className="mt-1 text-sm text-[#6f6679]">
            {active.length} active of {maximumApplications} allowed
            {revokedCount > 0
              ? ` · ${revokedCount} revoked`
              : ''}
          </p>
        </div>

        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setProblem('');
            }}
            className="rounded-xl bg-[#1f1235] px-5 py-3 text-sm font-bold text-white"
          >
            New application
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={create}
          aria-label="New application"
          className="rounded-2xl border border-[#e8e2ef] bg-white p-6"
        >
          <h3 className="text-lg font-bold text-[#1f1235]">
            New application
          </h3>

          <p className="mt-1 text-sm text-[#6f6679]">
            One application for each system that connects, so each
            can be changed or switched off on its own.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
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
                  placeholder="Warehouse ERP"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Description
                </span>

                <span className="ml-2 text-xs font-normal text-[#6f6679]">
                  Optional
                </span>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  maxLength={300}
                  rows={3}
                  placeholder="What it does and who to contact about it"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Key lifetime
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

                <span className="mt-1 block text-xs text-[#6f6679]">
                  A key with an end date limits the harm if it
                  leaks. You can replace a key at any time.
                </span>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-[#1f1235]">
                Permissions
              </legend>

              <p className="mb-3 mt-1 text-xs text-[#6f6679]">
                Give only what the system needs. You can change
                these later.
              </p>

              <ScopePicker
                scopes={scopes}
                chosen={chosen}
                onChange={setChosen}
              />
            </fieldset>
          </div>

          {problem && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {problem}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white disabled:opacity-60"
            >
              {busy
                ? 'Creating...'
                : 'Create application'}
            </button>

            {applications.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setProblem('');
                }}
                className="rounded-xl border border-[#e8e2ef] px-5 py-3 font-semibold text-[#1f1235]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {applications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#d8cee6] bg-white p-8 text-center text-[#6f6679]">
          No applications yet. Create one for the first system you
          want to connect.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by name or ID"
              aria-label="Search applications"
              className="w-full max-w-xs rounded-xl border border-[#e8e2ef] bg-white px-4 py-2.5 text-sm"
            />

            {revokedCount > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#4f455c]">
                <input
                  type="checkbox"
                  checked={showRevoked}
                  onChange={(event) =>
                    setShowRevoked(
                      event.target.checked,
                    )
                  }
                />
                Show revoked
              </label>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d8cee6] bg-white p-6 text-center text-sm text-[#6f6679]">
              No application matches.
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((application) => {
                const state =
                  applicationState(application);

                return (
                  <li
                    key={application.id}
                    className="rounded-2xl border border-[#e8e2ef] bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/developers/${encodeURIComponent(application.id)}`}
                          className="break-words text-lg font-bold text-[#1f1235] underline-offset-4 hover:underline"
                        >
                          {application.name}
                        </Link>

                        {application.description && (
                          <p className="mt-1 break-words text-sm text-[#4f455c]">
                            {application.description}
                          </p>
                        )}

                        <p className="mt-2 break-all font-mono text-xs text-[#6f6679]">
                          {application.id}
                          {' · '}
                          {application.keyHint}
                        </p>
                      </div>

                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge tone={state.tone}>
                          {state.label}
                        </Badge>

                        <Badge tone="muted">
                          {application.environment === 'test'
                            ? 'Test'
                            : 'Live'}
                        </Badge>

                        <Link
                          href={`/developers/${encodeURIComponent(application.id)}`}
                          className="rounded-lg border border-[#d8cee6] px-3 py-2 text-sm font-semibold text-[#38205f]"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs text-[#6f6679]">
                          Requests today
                        </dt>
                        <dd className="font-semibold text-[#1f1235]">
                          {application.usage?.today.requests ?? 0}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-[#6f6679]">
                          Last 7 days
                        </dt>
                        <dd className="font-semibold text-[#1f1235]">
                          {application.usage?.weekRequests ?? 0}{' '}
                          <span className="ml-1 font-normal text-[#6f6679]">
                            {errorRate(application.usage)} errors
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-[#6f6679]">
                          Permissions
                        </dt>
                        <dd className="font-semibold text-[#1f1235]">
                          {application.scopes.length}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-[#6f6679]">
                          Activity
                        </dt>
                        <dd className="text-[#4f455c]">
                          {lastUsedLabel(application, when)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
