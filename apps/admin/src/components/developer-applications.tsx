'use client';

import {
  useRouter,
} from 'next/navigation';

import {
  FormEvent,
  useState,
} from 'react';

import {
  type ApplicationSummary,
  createProblem,
  firstRequest,
  groupScopes,
  lastUsedLabel,
  type ScopeOption,
} from '@/lib/developer-applications';

/* Times are shown in Bangladesh time, as on the Orders page. */
const dhakaTime =
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  });

function when(value: unknown): string {
  if (!value) {
    return '';
  }

  const date = new Date(String(value));

  return Number.isNaN(date.getTime())
    ? ''
    : dhakaTime.format(date);
}

async function reasonFrom(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);

  const reason = Array.isArray(body?.message)
    ? body.message.join(', ')
    : body?.message;

  return typeof reason === 'string' && reason
    ? reason
    : 'That did not work. Try again.';
}

/**
 * Registers API applications and switches them off.
 *
 * A new application's key is shown once, right after it is created. It
 * is kept only in this page's memory: a reload, or leaving the page,
 * loses it for good, because the server stores only a hash of it.
 */
export function DeveloperApplications({
  initialApplications,
  scopes,
  apiUrl,
}: {
  initialApplications: ApplicationSummary[];
  scopes: ScopeOption[];
  apiUrl: string;
}) {
  const router = useRouter();

  const [applications, setApplications] =
    useState(initialApplications);

  const [name, setName] =
    useState('');

  const [chosen, setChosen] =
    useState<string[]>([]);

  const [busy, setBusy] =
    useState(false);

  const [problem, setProblem] =
    useState('');

  // The one and only showing of a new key.
  const [issued, setIssued] =
    useState<{ name: string; key: string } | null>(null);

  const [copied, setCopied] =
    useState(false);

  function toggle(scope: string) {
    setChosen((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );
  }

  async function create(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const invalid = createProblem(name, chosen);

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
            scopes: chosen,
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
      setCopied(false);
      setApplications((current) => [
        application,
        ...current,
      ]);
      setName('');
      setChosen([]);

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

  async function revoke(
    application: ApplicationSummary,
  ) {
    if (
      !window.confirm(
        `Revoke "${application.name}"? Its key stops working immediately and cannot be switched back on. Any system still using it will be refused.`,
      )
    ) {
      return;
    }

    setProblem('');

    try {
      const response = await fetch(
        `/api/backend/developer-applications/${encodeURIComponent(application.id)}/revoke`,
        { method: 'POST' },
      );

      if (!response.ok) {
        setProblem(await reasonFrom(response));
        return;
      }

      const updated = await response.json();

      setApplications((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      router.refresh();
    } catch {
      setProblem(
        'Check your internet connection, then try again.',
      );
    }
  }

  async function copyKey() {
    if (!issued) {
      return;
    }

    try {
      await navigator.clipboard.writeText(issued.key);
      setCopied(true);
    } catch {
      // The key is on screen and can be selected by hand.
      setCopied(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <form
        onSubmit={create}
        className="h-fit rounded-2xl border border-[#e8e2ef] bg-white p-6"
      >
        <h2 className="text-xl font-bold text-[#1f1235]">
          New application
        </h2>

        <p className="mt-1 text-sm text-[#6f6679]">
          One application for each system that connects.
        </p>

        <label className="mt-5 block">
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

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-[#1f1235]">
            Permissions
          </legend>

          <p className="mt-1 text-xs text-[#6f6679]">
            Give only what the system needs. All of these only
            read; none can change your shop.
          </p>

          <div className="mt-3 space-y-4">
            {groupScopes(scopes).map((group) => (
              <div key={group.group}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6f6679]">
                  {group.group}
                </p>

                {group.scopes.map((scope) => (
                  <label
                    key={scope.scope}
                    className="mt-2 flex cursor-pointer items-start gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.includes(
                        scope.scope,
                      )}
                      onChange={() =>
                        toggle(scope.scope)
                      }
                      className="mt-1"
                    />

                    <span>
                      <span className="block font-mono text-[#1f1235]">
                        {scope.scope}
                      </span>

                      <span className="block text-[#6f6679]">
                        {scope.allows}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>

        {problem && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {problem}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          {busy
            ? 'Creating...'
            : 'Create application'}
        </button>
      </form>

      <div className="min-w-0 space-y-4">
        {issued && (
          <section
            aria-label="New API key"
            className="rounded-2xl border-2 border-[#38205f] bg-[#faf8fc] p-6"
          >
            <h2 className="text-lg font-bold text-[#1f1235]">
              Key for {issued.name}
            </h2>

            <p className="mt-1 text-sm text-[#4f455c]">
              Copy it now and store it somewhere safe. It is shown
              only this once: when you leave or reload this page it
              cannot be shown again. If it is lost, revoke the
              application and create a new one.
            </p>

            <p className="mt-4 break-all rounded-xl border border-[#d8cee6] bg-white px-4 py-3 font-mono text-sm text-[#1f1235]">
              {issued.key}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copyKey}
                className="rounded-lg bg-[#1f1235] px-4 py-2 text-sm font-semibold text-white"
              >
                Copy key
              </button>

              <span
                role="status"
                className="text-sm text-[#4f455c]"
              >
                {copied ? 'Copied.' : ''}
              </span>
            </div>

            <p className="mt-5 text-sm font-semibold text-[#1f1235]">
              A first request to check it works
            </p>

            <pre className="mt-2 overflow-x-auto rounded-xl bg-[#1f1235] px-4 py-3 text-xs text-white">
              {firstRequest(apiUrl, issued.key)}
            </pre>
          </section>
        )}

        {applications.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d8cee6] bg-white p-8 text-center text-[#6f6679]">
            No applications yet. Create one for the first system
            you want to connect.
          </p>
        ) : (
          applications.map((application) => (
            <article
              key={application.id}
              className="rounded-2xl border border-[#e8e2ef] bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-bold text-[#1f1235]">
                    {application.name}
                  </h3>

                  <p className="mt-1 font-mono text-xs text-[#6f6679]">
                    {application.id}
                    {' · '}
                    {application.keyHint}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      application.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-[#f2edf8] text-[#6f6679]'
                    }`}
                  >
                    {application.status === 'active'
                      ? 'Active'
                      : 'Revoked'}
                    {' · '}
                    {application.environment === 'test'
                      ? 'Test'
                      : 'Live'}
                  </span>

                  {application.status === 'active' && (
                    <button
                      type="button"
                      onClick={() =>
                        revoke(application)
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {application.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full bg-[#f2edf8] px-3 py-1 font-mono text-xs text-[#38205f]"
                  >
                    {scope}
                  </span>
                ))}
              </div>

              <p className="mt-4 text-xs text-[#6f6679]">
                {lastUsedLabel(application, when)}
                {when(application.createdAt)
                  ? ` · Created ${when(application.createdAt)}`
                  : ''}
                {application.createdBy
                  ? ` by ${application.createdBy}`
                  : ''}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
