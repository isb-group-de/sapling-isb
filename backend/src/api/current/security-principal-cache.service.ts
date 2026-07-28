import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PersonItem } from '../../entity/PersonItem';
import {
  SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES,
  SECURITY_PRINCIPAL_CACHE_TTL_MS,
} from '../../constants/project.constants';

type CacheEntry = {
  expiresAt: number;
  person: PersonItem | null;
};

/**
 * Keeps the security graph used by guards short-lived and coalesces concurrent
 * cache misses. Token/session validity itself is deliberately checked outside
 * this cache so revocation and expiry remain immediate.
 */
@Injectable()
export class SecurityPrincipalCacheService {
  private readonly entries = new Map<number, CacheEntry>();
  private readonly pending = new Map<number, Promise<PersonItem | null>>();

  constructor(private readonly em: EntityManager) {}

  get(personHandle: number): Promise<PersonItem | null> {
    const cached = this.entries.get(personHandle);
    if (cached && cached.expiresAt > Date.now()) {
      this.touch(personHandle, cached);
      return Promise.resolve(cached.person);
    }
    if (cached) {
      this.entries.delete(personHandle);
    }

    const inFlight = this.pending.get(personHandle);
    if (inFlight) {
      return inFlight;
    }

    const load = this.load(personHandle)
      .then((person) => {
        this.set(personHandle, person);
        return person;
      })
      .finally(() => {
        this.pending.delete(personHandle);
      });
    this.pending.set(personHandle, load);
    return load;
  }

  invalidate(personHandle: number | null | undefined): void {
    if (typeof personHandle === 'number') {
      this.entries.delete(personHandle);
    }
  }

  invalidateAll(): void {
    this.entries.clear();
  }

  getStats(): {
    size: number;
    pending: number;
    ttlMs: number;
    maxEntries: number;
  } {
    return {
      size: this.entries.size,
      pending: this.pending.size,
      ttlMs: SECURITY_PRINCIPAL_CACHE_TTL_MS,
      maxEntries: SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES,
    };
  }

  private async load(personHandle: number): Promise<PersonItem | null> {
    const em = this.em.fork();
    const person = await em.findOne(
      PersonItem,
      { handle: personHandle },
      {
        populate: [
          'company',
          'company.country',
          'company.holidayGroup',
          'type',
          'language',
          'holidayGroup',
          'roles',
          'roles.stage',
          'roles.permissions',
          'roles.permissions.entity',
          'roles.permissions.fieldPermissions',
        ],
      },
    );

    delete person?.loginPassword;
    return person ?? null;
  }

  private set(personHandle: number, person: PersonItem | null): void {
    if (SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES <= 0) {
      return;
    }
    while (this.entries.size >= SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES) {
      const oldestKey = this.entries.keys().next().value as number | undefined;
      if (oldestKey == null) break;
      this.entries.delete(oldestKey);
    }
    this.entries.set(personHandle, {
      person,
      expiresAt: Date.now() + SECURITY_PRINCIPAL_CACHE_TTL_MS,
    });
  }

  private touch(personHandle: number, entry: CacheEntry): void {
    this.entries.delete(personHandle);
    this.entries.set(personHandle, entry);
  }
}
