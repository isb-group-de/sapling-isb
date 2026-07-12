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
        status: {
          name: 'status',
          type: 'TicketStatusItem',
          kind: 'm:1',
          referencedPKs: ['handle'],
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
    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({
      name: 'status',
      referenceName: 'ticketStatus',
      isReference: true,
    });
    expect(second).not.toBe(first);
  });
});
