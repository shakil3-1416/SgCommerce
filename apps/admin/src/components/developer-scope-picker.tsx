'use client';

import {
  groupScopes,
  type ScopeOption,
} from '@/lib/developer-applications';

/**
 * The permissions an application can have, by group. Permissions that
 * are planned but not available yet are listed and cannot be ticked, so
 * it is clear what is coming without anything being granted early.
 */
export function ScopePicker({
  scopes,
  chosen,
  onChange,
  disabled = false,
}: {
  scopes: ScopeOption[];
  chosen: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(scope: string) {
    onChange(
      chosen.includes(scope)
        ? chosen.filter((item) => item !== scope)
        : [...chosen, scope],
    );
  }

  return (
    <div className="space-y-4">
      {groupScopes(scopes).map((group) => (
        <div key={group.group}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6f6679]">
            {group.group}
          </p>

          {group.scopes.map((scope) => (
            <label
              key={scope.scope}
              className={`mt-2 flex items-start gap-3 text-sm ${
                scope.available && !disabled
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-60'
              }`}
            >
              <input
                type="checkbox"
                aria-label={scope.scope}
                checked={chosen.includes(scope.scope)}
                disabled={!scope.available || disabled}
                onChange={() => toggle(scope.scope)}
                className="mt-1"
              />

              <span className="min-w-0">
                <span className="block font-mono text-[#1f1235]">
                  {scope.scope}

                  {!scope.available && (
                    <span className="ml-2 rounded-full bg-[#f2edf8] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-[#6f6679]">
                      Planned
                    </span>
                  )}

                  {scope.available && scope.access === 'write' && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                      Can change data
                    </span>
                  )}
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
  );
}
