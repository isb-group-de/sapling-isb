import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../../../auth/auth.module';
import { AiPromptService } from './ai-prompt.service';
import { AiPromptController } from './ai-prompt.controller';
import { AiPromptScopeInterceptor } from './ai-prompt-scope.interceptor';

@Global()
@Module({
  imports: [AuthModule],
  providers: [
    AiPromptService,
    { provide: APP_INTERCEPTOR, useClass: AiPromptScopeInterceptor },
  ],
  controllers: [AiPromptController],
  exports: [AiPromptService],
})
export class AiPromptModule {}
