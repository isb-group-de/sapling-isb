import { createHash } from 'crypto';
import { EntityManager } from '@mikro-orm/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { TranslationItem } from '../../entity/TranslationItem';

export interface TranslationBundle {
  messages: Record<string, Record<string, string>>;
  etag: string;
}

/** Reads committed data on every revalidation, including seeder/native writes. */
@Injectable()
export class TranslationBundleService {
  constructor(private readonly em: EntityManager) {}

  async load(language: string, entities: string): Promise<TranslationBundle> {
    if (typeof language !== 'string' || typeof entities !== 'string')
      throw new BadRequestException('translation.invalidBundleRequest');
    const namespaces = [
      ...new Set(entities.split(',').map((s) => s.trim())),
    ].sort();
    if (
      !/^[a-zA-Z0-9-]{1,16}$/.test(language) ||
      namespaces.length > 100 ||
      namespaces.some((name) => !/^[a-zA-Z0-9_.-]{1,64}$/.test(name))
    ) {
      throw new BadRequestException('translation.invalidBundleRequest');
    }
    const rows = await this.em.find(
      TranslationItem,
      {
        language: { handle: language },
        entity: { $in: namespaces },
      },
      {
        fields: ['entity', 'property', 'value'],
        orderBy: { entity: 'ASC', property: 'ASC' },
      },
    );
    const messages: TranslationBundle['messages'] = Object.create(
      null,
    ) as TranslationBundle['messages'];
    for (const name of namespaces)
      messages[name] = Object.create(null) as Record<string, string>;
    for (const row of rows) messages[row.entity][row.property] = row.value;
    const etag =
      '"' +
      createHash('sha256').update(JSON.stringify(messages)).digest('hex') +
      '"';
    return { messages, etag };
  }
}
