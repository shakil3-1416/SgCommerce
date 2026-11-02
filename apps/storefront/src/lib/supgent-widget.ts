import fallback from '../../supgent-widget.config.json';

/**
 * Where the SupGent Web Chat widget loads from.
 *
 * Deployment configuration is the environment: NEXT_PUBLIC_SUPGENT_WIDGET_URL,
 * NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL and NEXT_PUBLIC_SUPGENT_API_BASE (set in
 * the hosting project). The committed supgent-widget.config.json is a
 * DEVELOPMENT/TEST BOOTSTRAP fallback only (it currently points at rotating
 * local quick tunnels); it is never a production configuration mechanism.
 * All values are public (a script URL, a public embed id, an API base),
 * never secrets. Without a complete configuration the widget is not loaded.
 * URLs must be HTTPS, except http://localhost / http://127.0.0.1 in local
 * development (NODE_ENV !== "production"); see widgetUrl.
 */
export interface SupGentWidgetConfig {
  scriptUrl: string;
  channel: string;
  apiBase: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * HTTPS is required everywhere; plain HTTP is accepted ONLY for a loopback host
 * (localhost / 127.0.0.1 / [::1]) and ONLY while NODE_ENV is not "production",
 * so a developer can point the storefront at a SupGent stack running on this
 * machine. A deployed build never accepts an http: URL.
 */
function widgetUrl(value: string | undefined, nodeEnv: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === 'http:' && nodeEnv !== 'production' && LOCAL_HOSTS.has(url.hostname);
    return url.protocol === 'https:' || localHttp ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

export function supgentWidgetConfig(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPGENT_WIDGET_URL: process.env.NEXT_PUBLIC_SUPGENT_WIDGET_URL,
    NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL: process.env.NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL,
    NEXT_PUBLIC_SUPGENT_API_BASE: process.env.NEXT_PUBLIC_SUPGENT_API_BASE,
    NODE_ENV: process.env.NODE_ENV,
  },
  defaults: Partial<SupGentWidgetConfig> = fallback,
): SupGentWidgetConfig | null {
  const nodeEnv = env.NODE_ENV ?? 'production'; // unknown environment: the strict rule
  const scriptUrl = widgetUrl(env.NEXT_PUBLIC_SUPGENT_WIDGET_URL || defaults.scriptUrl, nodeEnv);
  const apiBase = widgetUrl(env.NEXT_PUBLIC_SUPGENT_API_BASE || defaults.apiBase, nodeEnv);
  const channel = (env.NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL || defaults.channel || '').trim();

  if (!scriptUrl || !apiBase || !/^wc_[A-Za-z0-9]{8,64}$/.test(channel)) {
    return null;
  }
  return { scriptUrl, channel, apiBase };
}
