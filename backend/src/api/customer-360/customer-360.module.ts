import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../../auth/auth.module';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { GenericModule } from '../generic/generic.module';
import { TemplateModule } from '../template/template.module';
import { Customer360Controller } from './customer-360.controller';
import { Customer360Service } from './customer-360.service';

@Module({
  imports: [
    AuthModule,
    GenericModule,
    TemplateModule,
    MikroOrmModule.forFeature(
      ENTITY_REGISTRY.map(
        (entry) => entry.class as new (...args: any[]) => unknown,
      ),
    ),
  ],
  controllers: [Customer360Controller],
  providers: [Customer360Service],
  exports: [Customer360Service],
})
export class Customer360Module {}
