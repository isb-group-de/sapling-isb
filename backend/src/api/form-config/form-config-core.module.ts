import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { FormConfigService } from './form-config.service';
import { FormConfigValidationService } from './form-config-validation.service';

/**
 * Owns the form-configuration providers without depending on HTTP-facing
 * feature modules. This keeps metadata consumers free of module cycles.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature(
      ENTITY_REGISTRY.map((entry) => entry.class as new () => any),
    ),
  ],
  providers: [FormConfigService, FormConfigValidationService],
  exports: [FormConfigService],
})
export class FormConfigCoreModule {}
