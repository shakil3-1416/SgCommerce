import { Injectable } from '@nestjs/common';

import {
  buildSessionFields,
  SessionOrder,
  SSLCOMMERZ_LIVE,
  SSLCOMMERZ_SANDBOX,
  SslcommerzConfig,
  ValidationResult,
} from './sslcommerz';

/* The gateway is given 20 seconds; a customer is waiting on the other side. */
const TIMEOUT_MS = 20_000;

export class GatewayError extends Error {}

/**
 * Talks to SSLCOMMERZ. Three calls are used:
 *
 *   - create a payment session (the customer is then sent to its page);
 *   - validate a payment by the validation id SSLCOMMERZ reports;
 *   - look up what happened to a transaction, by our order number.
 *
 * Configuration comes from the environment:
 *
 *   SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD   the store credentials
 *   SSLCOMMERZ_LIVE=true                             real payments; anything
 *                                                    else uses the sandbox
 *   STOREFRONT_URL                                   where customers return
 *   API_PUBLIC_URL                                   this API's public base
 *                                                    address (worked out by
 *                                                    itself on Vercel)
 */
@Injectable()
export class SslcommerzClient {
  /** The configuration, or null with the reason online payment is off. */
  config(): { config: SslcommerzConfig | null; missing: string[] } {
    const storeId = (process.env.SSLCOMMERZ_STORE_ID ?? '').trim();
    const storePassword = (process.env.SSLCOMMERZ_STORE_PASSWORD ?? '').trim();
    const storefrontUrl = (process.env.STOREFRONT_URL ?? '').trim().replace(/\/+$/, '');
    const apiUrl = this.apiUrl();

    const missing = [
      storeId ? '' : 'SSLCOMMERZ_STORE_ID',
      storePassword ? '' : 'SSLCOMMERZ_STORE_PASSWORD',
      storefrontUrl ? '' : 'STOREFRONT_URL',
      apiUrl ? '' : 'API_PUBLIC_URL',
    ].filter(Boolean);

    if (missing.length > 0) {
      return { config: null, missing };
    }

    return {
      config: {
        storeId,
        storePassword,
        live: process.env.SSLCOMMERZ_LIVE === 'true',
        apiUrl,
        storefrontUrl,
      },
      missing: [],
    };
  }

  /**
   * SSLCOMMERZ must be able to reach this API from the internet. An
   * explicit API_PUBLIC_URL wins; on Vercel the project's production
   * address is used.
   */
  private apiUrl(): string {
    const explicit = (process.env.API_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');

    if (explicit) {
      return explicit;
    }

    const vercelHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '').trim();

    if (vercelHost) {
      return `https://${vercelHost}/${process.env.API_PREFIX ?? 'api/v1'}`;
    }

    return '';
  }

  private base(config: SslcommerzConfig): string {
    return config.live ? SSLCOMMERZ_LIVE : SSLCOMMERZ_SANDBOX;
  }

  private async request(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;

    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new GatewayError('SSLCOMMERZ could not be reached.');
    }

    if (!response.ok) {
      throw new GatewayError(`SSLCOMMERZ answered with HTTP ${response.status}.`);
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new GatewayError('SSLCOMMERZ sent an answer that could not be read.');
    }
  }

  /** Creates a payment session and returns the page to send the customer to. */
  async createSession(
    config: SslcommerzConfig,
    order: SessionOrder,
  ): Promise<{ gatewayUrl: string; sessionKey: string }> {
    const answer = await this.request(`${this.base(config)}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(buildSessionFields(config, order)).toString(),
    });

    const gatewayUrl = answer.GatewayPageURL;

    if (
      String(answer.status ?? '').toUpperCase() !== 'SUCCESS' ||
      typeof gatewayUrl !== 'string' ||
      gatewayUrl === ''
    ) {
      throw new GatewayError(
        `SSLCOMMERZ did not start the payment: ${String(answer.failedreason || answer.status || 'no reason given')}`,
      );
    }

    return { gatewayUrl, sessionKey: String(answer.sessionkey ?? '') };
  }

  /** Order Validation API: the authoritative answer about one payment. */
  async validate(config: SslcommerzConfig, valId: string): Promise<ValidationResult> {
    const query = new URLSearchParams({
      val_id: valId,
      store_id: config.storeId,
      store_passwd: config.storePassword,
      format: 'json',
    });

    return (await this.request(
      `${this.base(config)}/validator/api/validationserverAPI.php?${query.toString()}`,
    )) as ValidationResult;
  }

  /** Transaction Query API: every attempt made against one order number. */
  async attemptsFor(config: SslcommerzConfig, tranId: string): Promise<ValidationResult[]> {
    const query = new URLSearchParams({
      tran_id: tranId,
      store_id: config.storeId,
      store_passwd: config.storePassword,
      format: 'json',
    });

    const answer = await this.request(
      `${this.base(config)}/validator/api/merchantTransIDvalidationAPI.php?${query.toString()}`,
    );

    if (String(answer.APIConnect ?? '').toUpperCase() !== 'DONE') {
      throw new GatewayError(
        `SSLCOMMERZ refused the lookup: ${String(answer.APIConnect ?? 'no reason given')}`,
      );
    }

    return Array.isArray(answer.element) ? (answer.element as ValidationResult[]) : [];
  }
}
