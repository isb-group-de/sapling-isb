import {
  getSaplingReferenceDependency,
  getSaplingReferenceTemplate,
} from './global/entity.decorator';
import {
  getSaplingReferenceCreate,
  getSaplingRelatedRecords,
} from './global/entity-reference-actions.decorator';
import { TicketItem } from './TicketItem';
import { EventItem } from './EventItem';
import { EffortEstimateItem } from './EffortEstimateItem';
import { InternalCaseItem } from './InternalCaseItem';
import { SalesOpportunityItem } from './SalesOpportunityItem';

describe('business reference actions', () => {
  it.each([
    [TicketItem, 'salesOpportunity', 'creatorCompany', 'creatorCompany'],
    [
      EffortEstimateItem,
      'salesOpportunity',
      'creatorCompany',
      'creatorCompany',
    ],
    [EffortEstimateItem, 'ticket', 'creatorCompany', 'creatorCompany'],
    [InternalCaseItem, 'salesOpportunity', 'customerCompany', 'creatorCompany'],
    [InternalCaseItem, 'ticket', 'customerCompany', 'creatorCompany'],
    [InternalCaseItem, 'effortEstimate', 'customerCompany', 'creatorCompany'],
    [EventItem, 'salesOpportunity', 'creatorCompany', 'creatorCompany'],
    [EventItem, 'ticket', 'creatorCompany', 'creatorCompany'],
    [EventItem, 'effortEstimate', 'creatorCompany', 'creatorCompany'],
    [EventItem, 'internalCase', 'creatorCompany', 'customerCompany'],
  ] as const)(
    'filters %p.%s through the existing customer dependency',
    (model, field, parentField, targetField) => {
      expect(getSaplingReferenceDependency(model.prototype, field)).toEqual({
        parentField,
        targetField,
        clearOnParentChange: true,
      });
    },
  );
  it.each([TicketItem, EventItem, EffortEstimateItem, SalesOpportunityItem])(
    'opts business contacts into creation on %p',
    (model) => {
      for (const field of [
        'creatorCompany',
        'creatorPerson',
        'assigneeCompany',
        'assigneePerson',
      ]) {
        expect(
          getSaplingReferenceCreate(model.prototype, field),
        ).not.toBeNull();
      }
      expect(getSaplingReferenceCreate(model.prototype, 'status')).toBeNull();
      expect(getSaplingReferenceCreate(model.prototype, 'type')).toBeNull();
    },
  );
  it('prefills a person company and a contract company using real target fields', () => {
    expect(
      getSaplingReferenceCreate(TicketItem.prototype, 'creatorPerson'),
    ).toEqual({ defaults: { company: 'creatorCompany' } });
    expect(getSaplingReferenceCreate(TicketItem.prototype, 'contract')).toEqual(
      { defaults: { company: 'creatorCompany' } },
    );
  });
  it('exposes the new links and their inverse collections', () => {
    expect(
      getSaplingReferenceCreate(EventItem.prototype, 'internalCase'),
    ).not.toBeNull();
    expect(
      getSaplingReferenceCreate(EventItem.prototype, 'effortEstimate'),
    ).not.toBeNull();
    expect(
      getSaplingReferenceCreate(InternalCaseItem.prototype, 'effortEstimate'),
    ).not.toBeNull();
    expect(new InternalCaseItem().events).toBeDefined();
    expect(new EffortEstimateItem().events).toBeDefined();
    expect(new EffortEstimateItem().internalCases).toBeDefined();
  });
  it('preserves validation metadata and defines indirect navigation', () => {
    expect(
      getSaplingReferenceTemplate(EventItem.prototype, 'ticket')?.mappings,
    ).toContainEqual({
      sourceField: 'salesOpportunity',
      targetField: 'salesOpportunity',
      overwrite: false,
      validate: true,
    });
    expect(
      getSaplingRelatedRecords(SalesOpportunityItem.prototype, 'events')?.paths,
    ).toContain('ticket.salesOpportunity');
  });
});
