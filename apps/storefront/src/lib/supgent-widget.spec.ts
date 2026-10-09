/**
 * Run with:
 *   pnpm --filter storefront exec tsx --test src/lib/supgent-widget.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { supgentWidgetConfig } from './supgent-widget';

const defaults = {
  scriptUrl: 'https://fallback.example.com/supgent-widget.js',
  channel: 'wc_fallback123',
  apiBase: 'https://api-fallback.example.com',
};

describe('supgentWidgetConfig', () => {
  it('prefers the environment over the committed fallback', () => {
    assert.deepEqual(
      supgentWidgetConfig(
        {
          NEXT_PUBLIC_SUPGENT_WIDGET_URL: 'https://widget.example.com/supgent-widget.js',
          NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL: 'wc_envchannel1',
          NEXT_PUBLIC_SUPGENT_API_BASE: 'https://api.example.com/',
        },
        defaults,
      ),
      {
        scriptUrl: 'https://widget.example.com/supgent-widget.js',
        channel: 'wc_envchannel1',
        apiBase: 'https://api.example.com',
      },
    );
  });

  it('falls back when the environment is empty', () => {
    assert.equal(supgentWidgetConfig({}, defaults)?.channel, 'wc_fallback123');
  });

  it('loads nothing for an incomplete or unsafe configuration', () => {
    assert.equal(supgentWidgetConfig({}, {}), null);
    assert.equal(supgentWidgetConfig({ NEXT_PUBLIC_SUPGENT_WIDGET_URL: 'http://plain.example.com/w.js' }, defaults), null);
    assert.equal(supgentWidgetConfig({ NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL: 'not-a-channel' }, defaults), null);
  });
});
