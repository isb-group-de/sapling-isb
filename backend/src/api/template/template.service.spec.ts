import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_MAP: {
    ticket: class TicketItem {},
    ticketStatus: class TicketStatusItem {},
  },
}));
jest.mock('../../entity/global/entity.decorator', () => ({
  getSaplingFormLayout: jest.fn(() => ({
    group: null,
    groupOrder: null,
    order: null,
    width: null,
    formVisible: null,
    tableOrder: null,
    tableVisible: null,
    mobileOrder: null,
    mobileVisible: null,
  })),
  getSaplingGenericReference: jest.fn(() => null),
  getSaplingInlineCollection: jest.fn(() => null),
  getSaplingKanban: jest.fn(() => null),
  getSaplingReferenceTemplate: jest.fn(() => null),
  getSaplingReferenceDependency: jest.fn(() => null),
  getSaplingOptions: jest.fn(() => []),
  hasSaplingOption: jest.fn(() => false),
}));

import { TemplateService } from './template.service';

describe('TemplateService', () => {
  it('calculates entity metadata once and reuses the cached template', () => {
    const get = jest.fn(() => ({
      properties: {
        handle: {
          name: 'handle',
          type: 'number',
          primary: true,
          autoincrement: true,
        },
        externalHandle: {
          name: 'externalHandle',
          type: 'string',
          nullable: false,
        },
        status: {
          name: 'status',
          type: 'TicketStatusItem',
          kind: 'm:1',
          nullable: false,
          default: 'open',
          deleteRule: 'set null',
        },
        title: {
          name: 'title',
          type: 'string',
          nullable: false,
        },
      },
    }));
    const service = new TemplateService({
      getMetadata: jest.fn(() => ({ get })),
    } as never);

    const first = service.getEntityTemplate('ticket');
    first.pop();
    const second = service.getEntityTemplate('ticket');

    expect(get).toHaveBeenCalledTimes(1);
    expect(second).toHaveLength(4);
    expect(second[1]).toMatchObject({
      name: 'externalHandle',
      isAutoIncrement: false,
      isRequired: true,
    });
    expect(second[2]).toMatchObject({
      name: 'status',
      referenceName: 'ticketStatus',
      isReference: true,
      nullable: false,
      default: 'open',
      deleteRule: 'set null',
      isRequired: false,
    });
    expect(second[3]).toMatchObject({
      name: 'title',
      nullable: false,
      default: null,
      isRequired: true,
    });
    expect(second).not.toBe(first);
  });

  it('rejects entities whose only primary key is not handle', () => {
    const get = jest.fn(() => ({
      properties: {
        code: {
          name: 'code',
          type: 'string',
          primary: true,
        },
      },
    }));
    const service = new TemplateService({
      getMetadata: jest.fn(() => ({ get })),
    } as never);

    expect(() => service.getEntityTemplate('ticketStatus')).toThrow(
      'expected exactly one primary key named "handle"',
    );
  });
});
