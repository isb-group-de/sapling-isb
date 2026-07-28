import { Module, forwardRef } from '@nestjs/common';
import { CurrentController } from './current.controller';
import { CurrentService } from './current.service';
import { CurrentMetadataService } from './current-metadata.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { AuthModule } from '../../auth/auth.module';
import { TemplateService } from '../template/template.service';
import { InboxModule } from '../inbox/inbox.module';
import { OpenTaskEventsModule } from './open-task-events.module';
import { FormConfigCoreModule } from '../form-config/form-config-core.module';
import { GenericCustomFieldService } from '../generic/generic-custom-field.service';
import { CalendarSyncModule } from '../../calendar/sync/calendar-sync.module';
import { FieldPermissionService } from './field-permission.service';
import { PermissionAdminController } from './permission-admin.controller';
import { GenericSanitizerService } from '../generic/generic-sanitizer.service';
import { SecurityPrincipalCacheService } from './security-principal-cache.service';

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Module for current user feature (controller + service)
 *
 * @property        {CurrentController} CurrentController   Controller for current user endpoints
 * @property        {CurrentService} CurrentService         Service for current user operations
 */

@Module({
  imports: [
    forwardRef(() => AuthModule),
    InboxModule,
    CalendarSyncModule,
    OpenTaskEventsModule,
    FormConfigCoreModule,
    MikroOrmModule.forFeature(
      ENTITY_REGISTRY.map((e) => e.class as new () => any),
    ),
  ],
  controllers: [CurrentController, PermissionAdminController],
  providers: [
    CurrentService,
    CurrentMetadataService,
    TemplateService,
    GenericCustomFieldService,
    FieldPermissionService,
    GenericSanitizerService,
    SecurityPrincipalCacheService,
  ],
  exports: [
    CurrentService,
    FieldPermissionService,
    GenericSanitizerService,
    OpenTaskEventsModule,
    SecurityPrincipalCacheService,
  ],
})
/**
 * Module class for current user feature.
 * @property {CurrentController} CurrentController Controller for current user endpoints
 * @property {CurrentService} CurrentService Service for current user operations
 */
export class CurrentModule {}
