import { Module, forwardRef } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../../auth/auth.module';
import {
  REDIS_ATTEMPTS,
  REDIS_BACKOFF_DELAY,
  REDIS_BACKOFF_STRATEGY,
  REDIS_ENABLED,
  REDIS_REMOVE_ON_COMPLETE,
  REDIS_REMOVE_ON_FAIL,
} from '../../constants/project.constants';
import { EntityItem } from '../../entity/EntityItem';
import { ExternalRecordLinkItem } from '../../entity/ExternalRecordLinkItem';
import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { ImportSourceItem } from '../../entity/ImportSourceItem';
import { ImportTemplateItem } from '../../entity/ImportTemplateItem';
import { ImportTemplateValueMappingItem } from '../../entity/ImportTemplateValueMappingItem';
import { PersonItem } from '../../entity/PersonItem';
import { AiModule } from '../ai/ai.module';
import { GenericModule } from '../generic/generic.module';
import { TemplateModule } from '../template/template.module';
import { ImportController } from './import.controller';
import { ImportAiSuggestionService } from './import-ai-suggestion.service';
import { ImportBatchQueryService } from './import-batch-query.service';
import { ImportBatchPresenterService } from './import-batch-presenter.service';
import { ImportFieldValidationService } from './import-field-validation.service';
import { ImportExecutionService } from './import-execution.service';
import { ImportMatchingService } from './import-matching.service';
import { ImportPayloadService } from './import-payload.service';
import { ImportProcessor } from './import.processor';
import { ImportReferenceResolverService } from './import-reference-resolver.service';
import { ImportService } from './import.service';
import { ImportTemplateService } from './import-template.service';
import { ImportUniqueConflictService } from './import-unique-conflict.service';
import { ImportValidationService } from './import-validation.service';
import { CurrentModule } from '../current/current.module';

const MockQueue = {
  add: (name: string, data: unknown) => {
    global.log?.warn?.(
      `Redis is disabled. Job '${name}' was NOT added. Data: ${JSON.stringify(data)}`,
    );
    return null;
  },
};

@Module({
  imports: [
    forwardRef(() => AiModule),
    AuthModule,
    GenericModule,
    TemplateModule,
    CurrentModule,
    ...(REDIS_ENABLED
      ? [
          BullModule.registerQueue({
            name: 'imports',
            defaultJobOptions: {
              attempts: REDIS_ATTEMPTS,
              backoff: {
                type: REDIS_BACKOFF_STRATEGY,
                delay: REDIS_BACKOFF_DELAY,
              },
              removeOnComplete: REDIS_REMOVE_ON_COMPLETE,
              removeOnFail: REDIS_REMOVE_ON_FAIL,
            },
          }),
        ]
      : []),
    MikroOrmModule.forFeature([
      EntityItem,
      ExternalRecordLinkItem,
      ImportBatchItem,
      ImportBatchRowItem,
      ImportSourceItem,
      ImportTemplateItem,
      ImportTemplateValueMappingItem,
      PersonItem,
    ]),
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    ImportAiSuggestionService,
    ImportBatchQueryService,
    ImportBatchPresenterService,
    ImportExecutionService,
    ImportFieldValidationService,
    ImportMatchingService,
    ImportPayloadService,
    ImportReferenceResolverService,
    ImportTemplateService,
    ImportUniqueConflictService,
    ImportValidationService,
    ...(REDIS_ENABLED ? [ImportProcessor] : []),
    ...(REDIS_ENABLED
      ? []
      : [
          {
            provide: getQueueToken('imports'),
            useValue: MockQueue,
          },
        ]),
  ],
  exports: [ImportService],
})
export class ImportModule {}
