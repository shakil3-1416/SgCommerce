/**
 * Wording and small rules for the Developers page, kept apart from the
 * screen so they can be tested without a browser.
 */

export interface ScopeOption {
  scope: string;
  group: string;
  allows: string;
}

export interface ApplicationSummary {
  id: string;
  name: string;
  environment: string;
  keyHint: string;
  scopes: string[];
  status: string;
  createdBy?: string;
  createdAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

/** Scopes under their group heading, in the order the API lists them. */
export function groupScopes(scopes: readonly ScopeOption[]): Array<{ group: string; scopes: ScopeOption[] }> {
  const groups: Array<{ group: string; scopes: ScopeOption[] }> = [];

  for (const scope of scopes) {
    const existing = groups.find((item) => item.group === scope.group);

    if (existing) {
      existing.scopes.push(scope);
    } else {
      groups.push({ group: scope.group, scopes: [scope] });
    }
  }

  return groups;
}

/** Why the form cannot be sent yet, or '' when it can. */
export function createProblem(name: string, chosen: readonly string[]): string {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return 'Give the application a name, for example "Warehouse ERP".';
  }

  if (trimmed.length > 80) {
    return 'Use a name of 80 characters or fewer.';
  }

  if (chosen.length === 0) {
    return 'Choose at least one permission.';
  }

  return '';
}

/** A first request a developer can paste into a terminal to check the key works. */
export function firstRequest(apiUrl: string, key: string): string {
  return `curl -H "Authorization: Bearer ${key}" ${apiUrl}`;
}

export function lastUsedLabel(application: ApplicationSummary, formatTime: (value: unknown) => string): string {
  if (application.status === 'revoked') {
    const revoked = formatTime(application.revokedAt);

    return revoked ? `Revoked ${revoked}` : 'Revoked';
  }

  const used = formatTime(application.lastUsedAt);

  return used ? `Last used ${used}` : 'Never used';
}
