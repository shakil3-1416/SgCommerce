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

  const local = {
    NEXT_PUBLIC_SUPGENT_WIDGET_URL: 'http://localhost:3001/supgent-widget.js',
    NEXT_PUBLIC_SUPGENT_WIDGET_CHANNEL: 'wc_localchannel1',
    NEXT_PUBLIC_SUPGENT_API_BASE: 'http://127.0.0.1:8000/',
  };

  it('accepts plain http for loopback hosts in local development only', () => {
    assert.deepEqual(supgentWidgetConfig({ ...local, NODE_ENV: 'development' }, {}), {
      scriptUrl: 'http://localhost:3001/supgent-widget.js',
      channel: 'wc_localchannel1',
      apiBase: 'http://127.0.0.1:8000',
    });
    assert.equal(supgentWidgetConfig({ ...local, NODE_ENV: 'test' }, {})?.channel, 'wc_localchannel1');
  });

  it('still requires https when deployed, and for any non-loopback http host', () => {
    assert.equal(supgentWidgetConfig({ ...local, NODE_ENV: 'production' }, {}), null);
    assert.equal(supgentWidgetConfig(local, {}), null); // NODE_ENV unknown: the strict rule applies
    assert.equal(
      supgentWidgetConfig({ ...local, NEXT_PUBLIC_SUPGENT_WIDGET_URL: 'http://storefront.example.com/w.js', NODE_ENV: 'development' }, {}),
      null,
    );
    assert.equal(
      supgentWidgetConfig({ ...local, NEXT_PUBLIC_SUPGENT_API_BASE: 'http://192.168.1.10:8000', NODE_ENV: 'development' }, {}),
      null,
    );
  });

  it('never leaves a hardcoded SupGent host in the root layout', async () => {
    const { readFile } = await import('node:fs/promises');
    const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(layout, /supgent\.com/);
    assert.match(layout, /src=\{widget\.scriptUrl\}/);
    assert.match(layout, /data-channel=\{widget\.channel\}/);
    assert.match(layout, /data-api-base=\{widget\.apiBase\}/);
  });
});
