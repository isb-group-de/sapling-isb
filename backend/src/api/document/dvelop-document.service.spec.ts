/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from '@mikro-orm/core';
import { jest, describe, expect, it } from '@jest/globals';
import { DvelopDocumentService } from './dvelop-document.service';
import { DvelopEntityMappingItem } from '../../entity/DvelopEntityMappingItem';
import type { DvelopConnectionItem } from '../../entity/DvelopConnectionItem';
import type { DvelopEntityMappingPropertyItem } from '../../entity/DvelopEntityMappingPropertyItem';
import type { DvelopObjectDefinitionItem } from '../../entity/DvelopObjectDefinitionItem';

jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_MAP: {
    ticket: class TicketItem {},
  },
}));

const asCollection = <T>(items: T[]) => ({
  getItems: () => items,
});

describe('DvelopDocumentService', () => {
  it('prefills the storage dialog only with properties of the selected category', async () => {
    const objectDefinition = {
      handle: 3,
      dvelopId: 'ticket_category',
      title: 'Ticket category',
    } as DvelopObjectDefinitionItem;
    const otherObjectDefinition = {
      handle: 4,
      dvelopId: 'other_category',
      title: 'Other category',
    } as DvelopObjectDefinitionItem;
    const connection = {
      handle: 1,
      baseUrl: 'https://tenant.d-velop.cloud/',
      repository: {
        handle: 2,
        dvelopId: 'repository',
      },
      isActive: true,
    } as DvelopConnectionItem;
    const mapping = {
      handle: 5,
      connection,
      objectDefinition,
      propertyMappings: asCollection<DvelopEntityMappingPropertyItem>([
        {
          isActive: true,
          sortOrder: 10,
          sourceField: 'title',
          property: {
            dvelopId: 'property_title',
            objectDefinition,
          },
        } as DvelopEntityMappingPropertyItem,
        {
          isActive: true,
          sortOrder: 20,
          sourceField: 'handle',
          property: {
            dvelopId: 'property_global',
            objectDefinition: null,
          },
        } as DvelopEntityMappingPropertyItem,
        {
          isActive: true,
          sortOrder: 30,
          sourceField: 'title',
          property: {
            dvelopId: 'property_caption',
            objectDefinition,
          },
        } as DvelopEntityMappingPropertyItem,
        {
          isActive: true,
          sortOrder: 40,
          sourceField: 'title',
          property: {
            dvelopId: 'property_remark',
            objectDefinition,
          },
        } as DvelopEntityMappingPropertyItem,
        {
          isActive: true,
          sortOrder: 50,
          staticValue: 'must-not-be-sent',
          property: {
            dvelopId: 'property_wrong_category',
            objectDefinition: otherObjectDefinition,
          },
        } as DvelopEntityMappingPropertyItem,
      ]),
      searchCategories: asCollection([]),
      entity: { handle: 'ticket' },
      isActive: true,
    } as unknown as DvelopEntityMappingItem;
    const record = { handle: 42, title: 'Slow article search' };
    const em = {
      findOne: jest.fn(async (entity: unknown) =>
        entity === DvelopEntityMappingItem ? mapping : record,
      ),
      getMetadata: () => ({
        get: () => ({
          properties: {
            handle: { type: 'number' },
          },
        }),
      }),
    } as unknown as EntityManager & {
      findOne: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
    };
    const service = new DvelopDocumentService(em);

    const result = await service.buildUploadDialogUrl('ticket', '42');
    const url = new URL(result.url ?? '');

    expect(url.pathname).toBe('/dms/new');
    expect(url.searchParams.get('repositoryid')).toBe('repository');
    expect(url.searchParams.get('objectdefinitionid')).toBe('ticket_category');
    expect(JSON.parse(url.searchParams.get('properties') ?? '{}')).toEqual({
      property_title: 'Slow article search',
      property_global: '42',
    });
  });
});
