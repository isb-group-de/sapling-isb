import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CurrentModule } from '../current/current.module';
import { TemplateModule } from '../template/template.module';
import { FormConfigController } from './form-config.controller';
import { FormConfigCoreModule } from './form-config-core.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    CurrentModule,
    TemplateModule,
    FormConfigCoreModule,
  ],
  controllers: [FormConfigController],
  exports: [FormConfigCoreModule],
})
export class FormConfigModule {}
