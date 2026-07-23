import { describe, expect, it } from '@jest/globals';
import { Customer360Service } from './customer-360.service';

type CustomerWhere = (
  entityHandle: string,
  scope: {
    anchor: 'company' | 'person';
    anchorRecord: Record<string, unknown>;
    projectedAnchor: Record<string, unknown>;
    companyHandle: number | null;
    personHandle: number | null;
    personHandles: number[];
  },
) => object;

type CombineWhere = (scopeFilter: object, userFilter: object) => object;

function createService() {
  return new Customer360Service(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function customerWhere(service: Customer360Service): CustomerWhere {
  const method = (
    service as unknown as {
      customerWhere: CustomerWhere;
    }
  ).customerWhere;
  return (entityHandle, scope) => method(entityHandle, scope);
}

function combineWhere(service: Customer360Service): CombineWhere {
  const method = (
    service as unknown as {
      combineWhere: CombineWhere;
    }
  ).combineWhere;
  return (scopeFilter, userFilter) => method(scopeFilter, userFilter);
}

describe('Customer360Service customer aggregation', () => {
  it('aggregates a company by direct company and contact-person customer links', () => {
    const where = customerWhere(createService())('ticket', {
      anchor: 'company',
      anchorRecord: {},
      projectedAnchor: {},
      companyHandle: 10,
      personHandle: null,
      personHandles: [20, 21],
    });

    expect(where).toEqual({
      $or: [{ creatorCompany: 10 }, { creatorPerson: { $in: [20, 21] } }],
    });
    expect(JSON.stringify(where)).not.toContain('assignee');
  });

  it('keeps a person scope narrow and includes only that participant for events', () => {
    const where = customerWhere(createService())('event', {
      anchor: 'person',
      anchorRecord: {},
      projectedAnchor: {},
      companyHandle: 10,
      personHandle: 20,
      personHandles: [20],
    });

    expect(where).toEqual({
      $or: [{ creatorPerson: 20 }, { participants: { handle: 20 } }],
    });
    expect(JSON.stringify(where)).not.toContain('creatorCompany');
    expect(JSON.stringify(where)).not.toContain('assignee');
  });

  it('uses explicit customer fields for outgoing deliveries', () => {
    const where = customerWhere(createService())('emailDelivery', {
      anchor: 'company',
      anchorRecord: {},
      projectedAnchor: {},
      companyHandle: 10,
      personHandle: null,
      personHandles: [20],
    });

    expect(where).toEqual({
      $or: [{ customerCompany: 10 }, { customerPerson: { $in: [20] } }],
    });
  });

  it('keeps the customer scope mandatory when related chip filters are applied', () => {
    const where = combineWhere(createService())(
      { creatorCompany: 10 },
      { status: { handle: { $in: ['open', 'waiting'] } } },
    );

    expect(where).toEqual({
      $and: [
        { creatorCompany: 10 },
        { status: { handle: { $in: ['open', 'waiting'] } } },
      ],
    });
  });
});
