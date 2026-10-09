import fallback from '../../supgent-widget.config.json';

/**
 * Where the SupGent Web Chat widget loads from. Environment first
 * (NEXT_PUBLIC_SUPGENT_WIDGET_URL, NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL,
 * NEXT_PUBLIC_SUPGENT_API_BASE); the committed supgent-widget.config.json
 * is the fallback for deployments whose environment is not set yet. All
 * three values are public (a script URL, a public embed id, an API base),
 * never secrets. Without a complete configuration the widget is not loaded.
 */
export interface SupGentWidgetConfig {
  scriptUrl: string;
  channel: string;
  apiBase: string;
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

export function supgentWidgetConfig(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPGENT_WIDGET_URL: process.env.NEXT_PUBLIC_SUPGENT_WIDGET_URL,
    NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL: process.env.NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL,
    NEXT_PUBLIC_SUPGENT_API_BASE: process.env.NEXT_PUBLIC_SUPGENT_API_BASE,
  },
  defaults: Partial<SupGentWidgetConfig> = fallback,
): SupGentWidgetConfig | null {
  const scriptUrl = httpsUrl(env.NEXT_PUBLIC_SUPGENT_WIDGET_URL || defaults.scriptUrl);
  const apiBase = httpsUrl(env.NEXT_PUBLIC_SUPGENT_API_BASE || defaults.apiBase);
  const channel = (env.NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL || defaults.channel || '').trim();

  if (!scriptUrl || !apiBase || !/^wc_[A-Za-z0-9]{8,64}$/.test(channel)) {
    return null;
  }
  return { scriptUrl, channel, apiBase };
}
