import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiError } from './api-error';
import {
  currentEnvironment,
  generateApiKey,
  hashApiKey,
  keyEnvironment,
  keyHint,
  looksLikeApiKey,
  newApplicationId,
  refusedScopes,
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

@Injectable()
export class ApiApplicationsService {
  constructor(
    @InjectModel(ApiApplication.name)
    private readonly applications: Model<ApiApplicationDocument>,
  ) {}

  /** What an admin sees. The hash never leaves the server. */
  private present(application: any) {
    return {
      id: application.appId,
      name: application.name,
      environment: application.environment,
      keyHint: application.keyHint,
      scopes: application.scopes ?? [],
      status: application.status,
      createdBy: application.createdBy ?? '',
      createdAt: application.createdAt ?? null,
      lastUsedAt: application.lastUsedAt ?? null,
      revokedAt: application.revokedAt ?? null,
    };
  }

  /** For the admin's Developers page: the applications, and what can be granted. */
  async overview() {
    const applications = await this.applications.find({}).sort({ createdAt: -1 }).lean();

    return {
      environment: currentEnvironment(),
      scopes: SCOPES.filter((item) => item.available).map((item) => ({ ...item })),
      applications: applications.map((application) => this.present(application)),
    };
  }

  /**
   * Registers an application and issues its credential. The answer holds
   * the credential in `key`: this is the only time it can be seen.
   */
  async create(input: { name: string; scopes: string[] }, createdBy: string) {
    const name = String(input.name ?? '').trim();
    const scopes = [...new Set(Array.isArray(input.scopes) ? input.scopes : [])];

    if (name.length < 2 || name.length > 80) {
      throw new BadRequestException('Give the application a name of 2 to 80 characters.');
    }

    if (scopes.length === 0) {
      throw new BadRequestException('Choose at least one permission.');
    }

    const refused = refusedScopes(scopes);

    if (refused.length > 0) {
      throw new BadRequestException(`These permissions cannot be granted: ${refused.join(', ')}.`);
    }

    const active = await this.applications.countDocuments({ status: 'active' });

    if (active >= MAX_ACTIVE_APPLICATIONS) {
      throw new BadRequestException(
        `There are already ${MAX_ACTIVE_APPLICATIONS} active applications. Revoke one that is no longer used first.`,
      );
    }

    const environment = currentEnvironment();
    const key = generateApiKey(environment);

    const saved = await this.applications.create({
      appId: newApplicationId(),
      name,
      environment,
      keyHash: hashApiKey(key),
      keyHint: keyHint(key),
      scopes,
      status: 'active',
      createdBy,
    });

    return { ...this.present(saved.toObject()), key };
  }

  /** Switches an application off for good. Safe to repeat. */
  async revoke(appId: string, revokedBy: string) {
    const current = await this.applications.findOne({ appId: String(appId) }).lean();

    if (!current) {
      throw new NotFoundException('Application not found');
    }

    if (current.status === 'revoked') {
      return this.present(current);
    }

    const updated = await this.applications
      .findOneAndUpdate(
        { appId: current.appId },
        { $set: { status: 'revoked', revokedAt: new Date(), revokedBy } },
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

    const application = await this.applications.findOne({ keyHash: hashApiKey(presented) }).lean();

    if (!application) {
      throw new ApiError(401, 'invalid_credential', 'The API key is not valid.');
    }

    if (application.status !== 'active') {
      throw new ApiError(401, 'credential_revoked', 'This API key has been revoked.');
    }

    const lastUsed = application.lastUsedAt ? new Date(application.lastUsedAt).getTime() : 0;

    if (Date.now() - lastUsed > LAST_USED_RESOLUTION_MS) {
      // Not worth failing a request over.
      await this.applications
        .updateOne({ appId: application.appId }, { $set: { lastUsedAt: new Date() } })
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
