// Import the application first: loading individual services can hide import cycles.
import '../../app.module';
import assert from 'node:assert/strict';
import { Global, Module, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/core';
import { AuthService } from '../../auth/auth.service';
import { GenericPermissionGuard } from '../../auth/guard/generic-permission.guard';
import { CurrentService } from '../current/current.service';
import { FieldPermissionService } from '../current/field-permission.service';
import { DocumentService } from '../document/document.service';
import { GenericService } from '../generic/generic.service';
import { ImportService } from '../import/import.service';
import { AiUsageTelemetryService } from '../system/services/ai-usage-telemetry.service';
import { TemplateService } from '../template/template.service';
import { AiModule } from './ai.module';
import { AiService } from './ai.service';
import { AiEvaluationService } from './ai-evaluation.service';
import { AiPromptModule } from './prompts/ai-prompt.module';

// Only infrastructure is replaced. AI providers, controllers and their module
// registration remain real; no module mocks or Jest transforms are involved.
const infrastructure = [
  EntityManager,
  AuthService,
  GenericPermissionGuard,
  CurrentService,
  FieldPermissionService,
  DocumentService,
  GenericService,
  ImportService,
  AiUsageTelemetryService,
  TemplateService,
];

@Global()
@Module({
  providers: infrastructure.map((provide) => ({
    provide,
    useValue: Object.freeze({}),
  })),
  exports: infrastructure,
})
class BootstrapInfrastructureModule {}

async function verifyBootstrap() {
  const providers = Reflect.getMetadata('providers', AiModule) as Type[];
  const controllers = Reflect.getMetadata('controllers', AiModule) as Type[];
  for (const provider of [...providers, ...controllers]) {
    const parameters =
      (Reflect.getMetadata('design:paramtypes', provider) as unknown[]) ?? [];
    const explicit =
      (Reflect.getMetadata('self:paramtypes', provider) as Array<{
        index: number;
        param: unknown;
      }>) ?? [];
    parameters.forEach((parameter, index) => {
      const token =
        explicit.find((entry) => entry.index === index)?.param ?? parameter;
      const resolved =
        token && typeof token === 'object' && 'forwardRef' in token
          ? (token as { forwardRef: () => unknown }).forwardRef()
          : token;
      assert.ok(
        resolved,
        `${provider.name}: undefined dependency at index ${index}`,
      );
    });
  }

  const builder = Test.createTestingModule({
    imports: [BootstrapInfrastructureModule, AiModule, AiPromptModule],
  });
  for (const module of [AiModule, AiPromptModule]) {
    const imports = Reflect.getMetadata('imports', module) as Array<
      Type | { forwardRef: () => Type }
    >;
    for (const dependency of imports) {
      builder
        .overrideModule(
          'forwardRef' in dependency ? dependency.forwardRef() : dependency,
        )
        .useModule(BootstrapInfrastructureModule);
    }
  }
  const module = await builder.compile();
  try {
    for (const provider of providers) {
      assert.ok(module.get(provider) instanceof provider, provider.name);
    }
    assert.ok(module.get(AiService) instanceof AiService);
    assert.ok(module.get(AiEvaluationService) instanceof AiEvaluationService);
    console.log(
      `Nest DI verified: ${providers.length} AI providers, ${controllers.length} controllers`,
    );
  } finally {
    // compile() creates real instances without invoking queue recovery or DB hooks.
    await module.close();
  }
}

if (require.main === module) {
  void verifyBootstrap().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
