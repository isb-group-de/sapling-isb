import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';

jest.mock('@mikro-orm/core', () => ({
  DeferMode: {
    INITIALLY_DEFERRED: 'deferred',
    INITIALLY_IMMEDIATE: 'immediate',
  },
  EntityManager: class {},
}));
jest.mock('../../entity/global/entity.decorator', () => ({
  Sapling: jest.fn(() => () => undefined),
  SaplingForm: jest.fn(() => () => undefined),
  SaplingDependsOn: jest.fn(() => () => undefined),
  SaplingGenericReference: jest.fn(() => () => undefined),
  SaplingInlineCollection: jest.fn(() => () => undefined),
  SaplingKanban: jest.fn(() => () => undefined),
  SaplingReferenceTemplate: jest.fn(() => () => undefined),
  hasSaplingOption: jest.fn(() => false),
}));
jest.mock('../../entity/global/entity.registry', () => ({
  ENTITY_MAP: {
    salesOpportunity: class SalesOpportunityItem {},
    person: class PersonItem {},
    personSession: class PersonSessionItem {},
    company: class CompanyItem {},
    ticket: class TicketItem {},
    event: class EventItem {},
    tag: class TagItem {},
    aiChatSession: class AiChatSessionItem {},
    aiProviderModel: class AiProviderModelItem {},
  },
  ENTITY_REGISTRY: [],
}));
jest.mock('../../entity/EntityItem', () => ({ EntityItem: class {} }));
jest.mock('../../entity/PersonItem', () => ({ PersonItem: class {} }));
jest.mock('../current/current.service', () => ({ CurrentService: class {} }));
jest.mock('../template/template.service', () => ({
  TemplateService: class {},
}));
jest.mock('../script/script.service', () => ({
  ScriptService: class {},
  ScriptMethods: {
    beforeRead: 0,
    afterRead: 1,
    beforeUpdate: 2,
    afterUpdate: 3,
    beforeInsert: 4,
    afterInsert: 5,
    beforeDelete: 6,
    afterDelete: 7,
    addReference: 8,
    deleteReference: 9,
  },
}));

import { GenericService } from './generic.service';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { hasSaplingOption } from '../../entity/global/entity.decorator';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import {
  ScriptResultServer,
  ScriptResultServerMethods,
} from '../../script/core/script.result.server';
import { ScriptMethods } from '../script/script.service';
import { GenericFilterService } from './generic-filter.service';
import { GenericMutationService } from './generic-mutation.service';
import { GenericPayloadService } from './generic-payload.service';
import { GenericPermissionService } from './generic-permission.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReadService } from './generic-read.service';
import { GenericRelationService } from './generic-relation.service';
import { GenericReferenceService } from './generic-reference.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import { GenericTimelineService } from './generic-timeline.service';
import { GenericChangeLogService } from './generic-change-log.service';
import { GenericOpenTaskEventsService } from './generic-open-task-events.service';
import { GenericUpdateConflictService } from './generic-update-conflict.service';

export const createTemplateField = (
  overrides: Partial<EntityTemplateDto>,
): EntityTemplateDto => ({
  name: '',
  type: 'string',
  isAutoIncrement: false,
  isUnique: false,
  referenceName: '',
  isReference: false,
  isRequired: false,
  nullable: false,
  isPersistent: true,
  options: [],
  formGroup: null,
  formGroupOrder: null,
  formOrder: null,
  formWidth: null,
  ...overrides,
});

export const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

export const waitForBackgroundTasks = async () => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  await Promise.resolve();
};

export const toScriptItems = (items: object | object[]): object[] =>
  Array.isArray(items) ? (items as object[]) : [items];

export const createGenericService = ({
  em,
  templateService,
  currentService,
  scriptService = {},
  openTaskEventsService = {
    notifyUsers: jest.fn(),
  },
}: {
  em: object;
  templateService: object;
  currentService: object;
  scriptService?: object;
  openTaskEventsService?: {
    notifyUsers: jest.Mock;
  };
}) =>
  (() => {
    const queryService = new GenericQueryService(templateService as never);
    const filterService = new GenericFilterService();
    const mutationService = new GenericMutationService(
      em as never,
      scriptService as never,
      filterService,
    );
    const permissionService = new GenericPermissionService(
      currentService as never,
      templateService as never,
    );
    const referenceService = new GenericReferenceService(
      em as never,
      templateService as never,
      permissionService,
      queryService,
    );
    const payloadService = new GenericPayloadService(referenceService);
    const readService = new GenericReadService(
      em as never,
      scriptService as never,
      filterService,
      permissionService,
    );
    const sanitizerService = new GenericSanitizerService(
      templateService as never,
    );
    const relationService = new GenericRelationService(
      em as never,
      templateService as never,
      permissionService,
      queryService,
      referenceService,
      sanitizerService,
    );
    const timelineService = new GenericTimelineService(
      templateService as never,
      currentService as never,
    );
    const changeLogService = new GenericChangeLogService(
      em as never,
      sanitizerService,
    );
    const openTaskEventService = new GenericOpenTaskEventsService(
      em as never,
      referenceService,
      openTaskEventsService as never,
    );
    const updateConflictService = new GenericUpdateConflictService(
      changeLogService,
      referenceService,
    );

    return new GenericService(
      em as never,
      templateService as never,
      queryService,
      readService,
      mutationService,
      payloadService,
      relationService,
      permissionService,
      referenceService,
      sanitizerService,
      timelineService,
      openTaskEventService,
      changeLogService,
      updateConflictService,
    );
  })();

export {
  ConflictException,
  EntityTemplateDto,
  hasSaplingOption,
  ENTITY_REGISTRY,
  ScriptResultServer,
  ScriptResultServerMethods,
  ScriptMethods,
  GenericService,
  GenericFilterService,
  GenericMutationService,
  GenericPayloadService,
  GenericPermissionService,
  GenericQueryService,
  GenericReadService,
  GenericRelationService,
  GenericReferenceService,
  GenericSanitizerService,
  GenericTimelineService,
  GenericChangeLogService,
  GenericOpenTaskEventsService,
  GenericUpdateConflictService,
};
