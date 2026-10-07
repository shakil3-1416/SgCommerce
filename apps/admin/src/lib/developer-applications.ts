/**
 * Wording and small rules for the Developers pages, kept apart from the
 * screens so they can be tested without a browser.
 */

export interface ScopeOption {
  scope: string;
  group: string;
  access: 'read' | 'write';
  allows: string;
  /** False for a permission that is planned but cannot be granted yet. */
  available: boolean;
}

export interface UsageDay {
  day: string;
  requests: number;
  errors: number;
}

export interface UsageSummary {
  today: UsageDay;
  week: UsageDay[];
  weekRequests: number;
  weekErrors: number;
}

export interface ApplicationSummary {
  id: string;
  name: string;
  description?: string;
  environment: string;
  keyHint: string;
  keyCreatedAt?: string | null;
  expiresAt?: string | null;
  previousKey?: { hint: string; worksUntil: string } | null;
  scopes: string[];
  status: string;
  createdBy?: string;
  createdAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: string;
  usage?: UsageSummary;
}

export interface RequestLine {
  requestId: string;
  appId: string;
  appName: string;
  method: string;
  path: string;
  status: number;
  code: string;
  durationMs: number;
  ip: string;
  userAgent: string;
  at: string | null;
}

export interface ApplicationEvent {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export type Tone = 'good' | 'warning' | 'bad' | 'muted';

const DAY_MS = 24 * 60 * 60 * 1000;

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
export function createProblem(name: string, chosen: readonly string[], description = ''): string {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return 'Give the application a name, for example "Warehouse ERP".';
  }

  if (trimmed.length > 80) {
    return 'Use a name of 80 characters or fewer.';
  }

  if (description.trim().length > 300) {
    return 'Keep the description to 300 characters or fewer.';
  }

  if (chosen.length === 0) {
    return 'Choose at least one permission.';
  }

  return '';
}

/**
 * Where an application stands, in two words and a colour. A key within
 * two weeks of its end date is flagged so it can be replaced in time.
 */
export function applicationState(application: ApplicationSummary, now: Date = new Date()): { label: string; tone: Tone } {
  if (application.status !== 'active') {
    return { label: 'Revoked', tone: 'muted' };
  }

  if (application.expiresAt) {
    const left = new Date(application.expiresAt).getTime() - now.getTime();

    if (left <= 0) {
      return { label: 'Key expired', tone: 'bad' };
    }

    if (left <= 14 * DAY_MS) {
      const days = Math.max(1, Math.ceil(left / DAY_MS));

      return { label: `Key expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' };
    }
  }

  return { label: 'Active', tone: 'good' };
}

export function expiryChoiceLabel(days: number): string {
  if (days === 0) {
    return 'Never expires';
  }

  return days === 365 ? 'Expires in 1 year' : `Expires in ${days} days`;
}

export function graceChoiceLabel(hours: number): string {
  if (hours === 0) {
    return 'Stop the old key now';
  }

  if (hours === 1) {
    return 'Keep the old key working for 1 hour';
  }

  return hours % 24 === 0
    ? `Keep the old key working for ${hours / 24} day${hours === 24 ? '' : 's'}`
    : `Keep the old key working for ${hours} hours`;
}

/** The chosen permissions that can change the shop's data, with what each allows. */
export function writeScopesIn(chosen: readonly string[], scopes: readonly ScopeOption[]): ScopeOption[] {
  return scopes.filter((scope) => scope.access === 'write' && chosen.includes(scope.scope));
}

/**
 * What to ask before an application is given permissions that can
 * change data, or '' when it is given none. Reading is harmless to
 * grant by mistake; writing is not, so it gets a second look.
 */
export function writeWarning(name: string, granted: readonly ScopeOption[]): string {
  if (granted.length === 0) {
    return '';
  }

  const list = granted.map((scope) => `- ${scope.scope}: ${scope.allows}`).join('\n');

  return `"${name}" will be able to change your shop's data:\n\n${list}\n\nAnyone who has its key can do this. Continue?`;
}

/** What a change of permissions adds and takes away, to confirm before saving. */
export function scopeChanges(before: readonly string[], after: readonly string[]): { added: string[]; removed: string[] } {
  return {
    added: after.filter((scope) => !before.includes(scope)),
    removed: before.filter((scope) => !after.includes(scope)),
  };
}

export function errorRate(usage: Pick<UsageSummary, 'weekRequests' | 'weekErrors'> | undefined): string {
  if (!usage || usage.weekRequests === 0) {
    return '0%';
  }

  const rate = (usage.weekErrors / usage.weekRequests) * 100;

  return rate > 0 && rate < 1 ? '<1%' : `${Math.round(rate)}%`;
}

/** Heights for a seven-day bar chart, as percentages of the busiest day. */
export function barHeights(week: readonly UsageDay[]): number[] {
  const most = Math.max(0, ...week.map((day) => day.requests));

  return week.map((day) => (most === 0 ? 0 : Math.max(day.requests > 0 ? 4 : 0, Math.round((day.requests / most) * 100))));
}

export function statusTone(status: number): Tone {
  if (status >= 500) {
    return 'bad';
  }

  return status >= 400 ? 'warning' : 'good';
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  scopes_changed: 'Permissions changed',
  key_rolled: 'Key replaced',
  revoked: 'Revoked',
};

export function eventLabel(action: string): string {
  return EVENT_LABELS[action] ?? action;
}

/** A first request a developer can paste into a terminal to check the key works. */
export function firstRequest(apiUrl: string, key: string): string {
  return `curl -H "Authorization: Bearer ${key}" ${apiUrl}`;
}

/** The same first request in three languages, for the reference page. */
export function snippets(apiUrl: string, key = 'sg_live_your_key'): Array<{ language: string; code: string }> {
  return [
    { language: 'curl', code: `curl -H "Authorization: Bearer ${key}" \\\n  "${apiUrl}/orders?limit=5"` },
    {
      language: 'JavaScript',
      code: `const response = await fetch("${apiUrl}/orders?limit=5", {\n  headers: { Authorization: "Bearer ${key}" },\n});\n\nconst { data, pagination } = await response.json();`,
    },
    {
      language: 'Python',
      code: `import requests\n\nresponse = requests.get(\n    "${apiUrl}/orders",\n    params={"limit": 5},\n    headers={"Authorization": "Bearer ${key}"},\n)\n\norders = response.json()["data"]`,
    },
  ];
}

/** The address of the request log, filtered. Empty filters are left out. */
export function requestsLink(filters: { appId?: string; status?: string; requestId?: string; cursor?: string }): string {
  const query = new URLSearchParams();

  if (filters.appId) query.set('app_id', filters.appId);
  if (filters.status) query.set('status', filters.status);
  if (filters.requestId) query.set('request_id', filters.requestId);
  if (filters.cursor) query.set('cursor', filters.cursor);

  const text = query.toString();

  return text ? `/developers/requests?${text}` : '/developers/requests';
}

export function lastUsedLabel(application: ApplicationSummary, formatTime: (value: unknown) => string): string {
  if (application.status === 'revoked') {
    const revoked = formatTime(application.revokedAt);

    return revoked ? `Revoked ${revoked}` : 'Revoked';
  }

  const used = formatTime(application.lastUsedAt);

  return used ? `Last used ${used}` : 'Never used';
}

/* Times are shown in Bangladesh time, as on the Orders page. */
const DHAKA_TIME = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});

/** "7 Oct 2026, 02:00", or '' when there is no valid time. */
export function when(value: unknown): string {
  if (!value) {
    return '';
  }

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? '' : DHAKA_TIME.format(date);
}

/** The reason a request to the admin API was refused, in the API's own words. */
export async function reasonFrom(response: { json(): Promise<unknown> }): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;

  const reason = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;

  return typeof reason === 'string' && reason ? reason : 'That did not work. Try again.';
}
