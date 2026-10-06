import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiError } from './api-error';
import { ApiRequestLogService } from './api-request-log.service';
import {
  currentEnvironment,
  DEVELOPER_API_VERSION,
  expiryDate,
  EXPIRY_CHOICES,
  generateApiKey,
  graceEnd,
  hashApiKey,
  keyEnvironment,
  keyHint,
  looksLikeApiKey,
  newApplicationId,
  RATE_WINDOW_SECONDS,
  READ_RATE_LIMIT,
  refusedScopes,
  ROLL_GRACE_CHOICES,
  SCOPES,
} from './developer-api';
import { ApiApplication, ApiApplicationDocument } from './schemas/api-application.schema';

/* "Last used" is for people to read; once a minute is precise enough. */
const LAST_USED_RESOLUTION_MS = 60_000;

/** How many applications can be active at once. */
export const MAX_ACTIVE_APPLICATIONS = 25;

export interface AuthenticatedApplication {
  appId: string;
  name: string;
  environment: string;
  scopes: string[];
}

function cleanName(value: unknown): string {
  const name = String(value ?? '').trim();

  if (name.length < 2 || name.length > 80) {
    throw new BadRequestException('Give the application a name of 2 to 80 characters.');
  }

  return name;
}

function cleanDescription(value: unknown): string {
  const description = String(value ?? '').trim();

  if (description.length > 300) {
    throw new BadRequestException('Keep the description to 300 characters or fewer.');
  }

  return description;
}

function cleanScopes(value: unknown): string[] {
  const scopes = [...new Set(Array.isArray(value) ? value.map((scope) => String(scope)) : [])];

  if (scopes.length === 0) {
    throw new BadRequestException('Choose at least one permission.');
  }

  const refused = refusedScopes(scopes);

  if (refused.length > 0) {
    throw new BadRequestException(`These permissions cannot be granted: ${refused.join(', ')}.`);
  }

  return scopes;
}

function cleanChoice(value: unknown, choices: readonly number[], what: string): number {
  const number = value === undefined || value === null || value === '' ? 0 : Number(value);

  if (!choices.includes(number)) {
    throw new BadRequestException(`${what} must be one of: ${choices.join(', ')}.`);
  }

  return number;
}

@Injectable()
export class ApiApplicationsService {
  constructor(
    @InjectModel(ApiApplication.name)
    private readonly applications: Model<ApiApplicationDocument>,
    private readonly log: ApiRequestLogService,
  ) {}

  /** What an admin sees. Hashes never leave the server. */
  private present(application: any) {
    const previousStillWorks =
      Boolean(application.previousKeyHash) &&
      application.previousKeyExpiresAt &&
      new Date(application.previousKeyExpiresAt).getTime() > Date.now();

    return {
      id: application.appId,
      name: application.name,
      description: application.description ?? '',
      environment: application.environment,
      keyHint: application.keyHint,
      keyCreatedAt: application.keyCreatedAt ?? application.createdAt ?? null,
      expiresAt: application.expiresAt ?? null,
      previousKey: previousStillWorks
        ? { hint: application.previousKeyHint ?? '', worksUntil: application.previousKeyExpiresAt }
        : null,
      scopes: application.scopes ?? [],
      status: application.status,
      createdBy: application.createdBy ?? '',
      createdAt: application.createdAt ?? null,
      lastUsedAt: application.lastUsedAt ?? null,
      revokedAt: application.revokedAt ?? null,
      revokedBy: application.revokedBy ?? '',
    };
  }

  private settings() {
    return {
      environment: currentEnvironment(),
      apiVersion: DEVELOPER_API_VERSION,
      rateLimit: { requests: READ_RATE_LIMIT, perSeconds: RATE_WINDOW_SECONDS },
      maximumApplications: MAX_ACTIVE_APPLICATIONS,
      expiryChoices: [...EXPIRY_CHOICES],
      rollGraceChoices: [...ROLL_GRACE_CHOICES],
      // What can be granted now, and what is planned, so the page can show both honestly.
      scopes: SCOPES.map((item) => ({ ...item })),
    };
  }

  private async find(appId: string) {
    const application = await this.applications.findOne({ appId: String(appId) }).lean();

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  /** For the admin's Developers page: every application with its recent usage. */
  async overview() {
    const applications = await this.applications.find({}).sort({ createdAt: -1 }).lean();
    const usage = await this.log.usageFor(applications.map((application) => application.appId));

    return {
      ...this.settings(),
      applications: applications.map((application) => ({
        ...this.present(application),
        usage: usage[application.appId],
      })),
    };
  }

  /** One application with its history, usage and latest requests. */
  async detail(appId: string) {
    const application = await this.find(appId);

    const [usage, recent] = await Promise.all([
      this.log.usageFor([application.appId]),
      this.log.list({ appId: application.appId, limit: 15 }),
    ]);

    return {
      ...this.settings(),
      application: this.present(application),
      usage: usage[application.appId],
      recentRequests: recent.requests,
      // Newest first. Events are stored in the order they happened, so two
      // changes made in the same millisecond still come out in the right order.
      events: [...(application.events ?? [])]
        .reverse()
        .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .map((event: any) => ({ at: event.at, actor: event.actor, action: event.action, detail: event.detail ?? '' })),
    };
  }

  /**
   * Registers an application and issues its credential. The answer holds
   * the credential in `key`: this is the only time it can be seen.
   */
  async create(
    input: { name: string; description?: string; scopes: string[]; expiresInDays?: number },
    createdBy: string,
  ) {
    const name = cleanName(input.name);
    const description = cleanDescription(input.description);
    const scopes = cleanScopes(input.scopes);
    const expiresInDays = cleanChoice(input.expiresInDays, EXPIRY_CHOICES, 'expiresInDays');

    const active = await this.applications.countDocuments({ status: 'active' });

    if (active >= MAX_ACTIVE_APPLICATIONS) {
      throw new BadRequestException(
        `There are already ${MAX_ACTIVE_APPLICATIONS} active applications. Revoke one that is no longer used first.`,
      );
    }

    const environment = currentEnvironment();
    const key = generateApiKey(environment);
    const now = new Date();

    const saved = await this.applications.create({
      appId: newApplicationId(),
      name,
      description,
      environment,
      keyHash: hashApiKey(key),
      keyHint: keyHint(key),
      keyCreatedAt: now,
      expiresAt: expiryDate(expiresInDays, now),
      scopes,
      status: 'active',
      createdBy,
      events: [{ at: now, actor: createdBy, action: 'created', detail: `Permissions: ${scopes.join(', ')}` }],
    });

    return { ...this.present(saved.toObject()), key };
  }

  /** Changes the name, the description or the permissions. Takes effect on the next request. */
  async update(
    appId: string,
    input: { name?: string; description?: string; scopes?: string[] },
    actor: string,
  ) {
    const current = await this.find(appId);

    if (current.status !== 'active') {
      throw new ConflictException('A revoked application cannot be changed.');
    }

    const set: Record<string, unknown> = {};
    const events: Array<{ at: Date; actor: string; action: string; detail: string }> = [];
    const now = new Date();

    if (input.name !== undefined) {
      const name = cleanName(input.name);

      if (name !== current.name) {
        set.name = name;
        events.push({ at: now, actor, action: 'updated', detail: `Renamed from "${current.name}" to "${name}"` });
      }
    }

    if (input.description !== undefined) {
      const description = cleanDescription(input.description);

      if (description !== (current.description ?? '')) {
        set.description = description;
        events.push({ at: now, actor, action: 'updated', detail: 'Description changed' });
      }
    }

    if (input.scopes !== undefined) {
      const scopes = cleanScopes(input.scopes);
      const before = current.scopes ?? [];
      const added = scopes.filter((scope) => !before.includes(scope));
      const removed = before.filter((scope: string) => !scopes.includes(scope));

      if (added.length > 0 || removed.length > 0) {
        set.scopes = scopes;
        events.push({
          at: now,
          actor,
          action: 'scopes_changed',
          detail: [
            added.length > 0 ? `Added: ${added.join(', ')}` : '',
            removed.length > 0 ? `Removed: ${removed.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('. '),
        });
      }
    }

    if (events.length === 0) {
      return this.present(current);
    }

    const updated = await this.applications
      .findOneAndUpdate(
        { appId: current.appId, status: 'active' },
        { $set: set, $push: { events: { $each: events } } },
        { new: true },
      )
      .lean();

    return this.present(updated ?? current);
  }

  /**
   * Replaces the key. The answer holds the new key, this once only. The
   * old key stops working at once, or after the grace period chosen.
   */
  async roll(appId: string, input: { graceHours?: number; expiresInDays?: number }, actor: string) {
    const current = await this.find(appId);

    if (current.status !== 'active') {
      throw new ConflictException('A revoked application cannot get a new key. Create a new application.');
    }

    const graceHours = cleanChoice(input.graceHours, ROLL_GRACE_CHOICES, 'graceHours');
    const expiresInDays = cleanChoice(input.expiresInDays, EXPIRY_CHOICES, 'expiresInDays');

    const now = new Date();
    const key = generateApiKey(currentEnvironment());
    const oldKeyWorksUntil = graceEnd(graceHours, now);

    const updated = await this.applications
      .findOneAndUpdate(
        // Only if the key is still the one this request saw: two people rolling at once must not both win.
        { appId: current.appId, status: 'active', keyHash: current.keyHash },
        {
          $set: {
            keyHash: hashApiKey(key),
            keyHint: keyHint(key),
            keyCreatedAt: now,
            expiresAt: expiryDate(expiresInDays, now),
            previousKeyHash: oldKeyWorksUntil ? current.keyHash : '',
            previousKeyHint: oldKeyWorksUntil ? current.keyHint : '',
            previousKeyExpiresAt: oldKeyWorksUntil,
          },
          $push: {
            events: {
              at: now,
              actor,
              action: 'key_rolled',
              detail: oldKeyWorksUntil
                ? `Old key ${current.keyHint} keeps working for ${graceHours} hour(s)`
                : `Old key ${current.keyHint} stopped working at once`,
            },
          },
        },
        { new: true },
      )
      .lean();

    if (!updated) {
      throw new ConflictException('The key was changed by someone else a moment ago. Reload the page.');
    }

    return { ...this.present(updated), key };
  }

  /** Switches an application off for good. Safe to repeat. */
  async revoke(appId: string, revokedBy: string) {
    const current = await this.find(appId);

    if (current.status === 'revoked') {
      return this.present(current);
    }

    const now = new Date();

    const updated = await this.applications
      .findOneAndUpdate(
        { appId: current.appId },
        {
          $set: {
            status: 'revoked',
            revokedAt: now,
            revokedBy,
            previousKeyHash: '',
            previousKeyHint: '',
            previousKeyExpiresAt: null,
          },
          $push: { events: { at: now, actor: revokedBy, action: 'revoked', detail: '' } },
        },
        { new: true },
      )
      .lean();

    return this.present(updated ?? current);
  }

  /**
   * Recognises a presented credential. An unknown credential and a
   * mistyped one get the same answer, so nothing is learned by guessing.
   */
  async authenticate(presented: string): Promise<AuthenticatedApplication> {
    if (!looksLikeApiKey(presented)) {
      throw new ApiError(401, 'invalid_credential', 'The API key is not valid.');
    }

    const environment = currentEnvironment();

    if (keyEnvironment(presented) !== environment) {
      throw new ApiError(
        401,
        'credential_environment_mismatch',
        `This is a ${keyEnvironment(presented)} API key and cannot be used with the ${environment} API.`,
      );
    }

    const hash = hashApiKey(presented);

    const application = await this.applications
      .findOne({ $or: [{ keyHash: hash }, { previousKeyHash: hash }] })
      .lean();

    if (!application) {
      throw new ApiError(401, 'invalid_credential', 'The API key is not valid.');
    }

    if (application.status !== 'active') {
      throw new ApiError(401, 'credential_revoked', 'This API key has been revoked.');
    }

    const now = Date.now();

    if (application.keyHash !== hash) {
      // A key that was replaced: it works only until its grace period ends.
      const worksUntil = application.previousKeyExpiresAt
        ? new Date(application.previousKeyExpiresAt).getTime()
        : 0;

      if (worksUntil <= now) {
        throw new ApiError(401, 'credential_replaced', 'This API key has been replaced. Use the new key.');
      }
    } else if (application.expiresAt && new Date(application.expiresAt).getTime() <= now) {
      throw new ApiError(401, 'credential_expired', 'This API key has expired. Ask the merchant for a new one.');
    }

    const lastUsed = application.lastUsedAt ? new Date(application.lastUsedAt).getTime() : 0;

    if (now - lastUsed > LAST_USED_RESOLUTION_MS) {
      // Not worth failing a request over.
      await this.applications
        .updateOne({ appId: application.appId }, { $set: { lastUsedAt: new Date(now) } })
        .catch(() => undefined);
    }

    return {
      appId: application.appId,
      name: application.name,
      environment: application.environment,
      scopes: application.scopes ?? [],
    };
  }
}
