import { Module } from '@nestjs/common';
import { GenericController } from './generic.controller';
import { GenericReferenceController } from './generic-reference.controller';
import { GenericImportController } from './generic-import.controller';
import { GlobalSearchController } from './global-search.controller';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchIndexService } from './global-search-index.service';
import { GenericFilterService } from './generic-filter.service';
import { GenericChangeLogService } from './generic-change-log.service';
import { GenericCustomFieldService } from './generic-custom-field.service';
import { GenericMutationService } from './generic-mutation.service';
import { GenericOpenTaskEventsService } from './generic-open-task-events.service';
import { GenericPayloadService } from './generic-payload.service';
import { GenericPermissionService } from './generic-permission.service';
import { GenericQueryService } from './generic-query.service';
import { GenericReadService } from './generic-read.service';
import { GenericRelationService } from './generic-relation.service';
import { GenericReferenceService } from './generic-reference.service';
import { GenericSanitizerService } from './generic-sanitizer.service';
import { GenericService } from './generic.service';
import { GenericTimelineService } from './generic-timeline.service';
import { GenericTimelineDateService } from './generic-timeline-date.service';
import { GenericTimelineDescriptorService } from './generic-timeline-descriptor.service';
import { GenericTimelineProjectionService } from './generic-timeline-projection.service';
import { GenericTimelineQueryService } from './generic-timeline-query.service';
import { GenericListQueryService } from './generic-list-query.service';
import { GenericInlineCollectionService } from './generic-inline-collection.service';
import { GenericRelationMutationService } from './generic-relation-mutation.service';
import { GenericEntityMutationService } from './generic-entity-mutation.service';
import { GenericUpdateConflictService } from './generic-update-conflict.service';
import { GenericBulkMutationService } from './generic-bulk-mutation.service';
import { GenericDeleteService } from './generic-delete.service';
import { EventRecurrenceController } from './event-recurrence.controller';
import { EventRecurrenceMutationService } from './event-recurrence-mutation.service';
import { TemplateModule } from '../template/template.module';
import { ScriptModule } from '../script/script.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { CurrentModule } from '../current/current.module';
import { OpenTaskEventsModule } from '../current/open-task-events.module';
import { AuthModule } from '../../auth/auth.module';
import { MailModule } from '../mail/mail.module';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Module for generic CRUD operations on arbitrary entities. Registers controllers, providers, and imports required modules.
 *
 * @property        {GenericController[]} controllers  Controllers for entity operations
 * @property        {GenericService[]} providers       Providers for business logic
 * @property        {Module[]} imports                 Imported modules for entity, template, and script handling
 */
@Module({
  imports: [
    AuthModule,
    // Type assertion required due to MikroORM typing limitations
    MikroOrmModule.forFeature(
      ENTITY_REGISTRY.map((e) => e.class as new (...args: any[]) => unknown),
    ),
    TemplateModule,
    ScriptModule,
    CurrentModule,
    OpenTaskEventsModule,
    MailModule,
  ],
  controllers: [
    GenericController,
    GenericReferenceController,
    GenericImportController,
    GlobalSearchController,
    EventRecurrenceController,
  ],
  providers: [
    GenericService,
    GlobalSearchService,
    GlobalSearchIndexService,
    GenericChangeLogService,
    GenericCustomFieldService,
    GenericFilterService,
    GenericMutationService,
    GenericOpenTaskEventsService,
    GenericPayloadService,
    GenericQueryService,
    GenericReadService,
    GenericRelationService,
    GenericPermissionService,
    GenericReferenceService,
    GenericSanitizerService,
    GenericTimelineService,
    GenericTimelineDateService,
    GenericTimelineDescriptorService,
    GenericTimelineProjectionService,
    GenericTimelineQueryService,
    GenericListQueryService,
    GenericInlineCollectionService,
    GenericRelationMutationService,
    GenericEntityMutationService,
    GenericUpdateConflictService,
    GenericBulkMutationService,
    GenericDeleteService,
    EventRecurrenceMutationService,
  ],
  exports: [
    GenericService,
    GenericPermissionService,
    GenericFilterService,
    GenericQueryService,
    GenericCustomFieldService,
    GenericReadService,
    GenericSanitizerService,
    GlobalSearchIndexService,
  ],
})
export class GenericModule {}
