import { MODULE_METADATA } from '@nestjs/common/constants';
import { FormConfigCoreModule } from '../form-config/form-config-core.module';
import { FormConfigModule } from '../form-config/form-config.module';
import { FormConfigService } from '../form-config/form-config.service';
import { CurrentModule } from './current.module';

describe('CurrentModule', () => {
  it('consumes FormConfigService through the cycle-free core module', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      CurrentModule,
    ) as Array<unknown>;
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      CurrentModule,
    ) as Array<unknown>;
    const resolvedImports = imports.map((entry) =>
      entry && typeof entry === 'object' && 'forwardRef' in entry
        ? (entry as { forwardRef: () => unknown }).forwardRef()
        : entry,
    );

    expect(resolvedImports).toContain(FormConfigCoreModule);
    expect(resolvedImports).not.toContain(FormConfigModule);
    expect(providers).not.toContain(FormConfigService);
  });

  it('keeps every FormConfigModule import resolvable', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      FormConfigModule,
    ) as Array<unknown>;
    const resolvedImports = imports.map((entry) =>
      entry && typeof entry === 'object' && 'forwardRef' in entry
        ? (entry as { forwardRef: () => unknown }).forwardRef()
        : entry,
    );

    expect(resolvedImports).not.toContain(undefined);
    expect(resolvedImports.every(Boolean)).toBe(true);
  });

  it('owns FormConfigService and its validation dependency in one core module', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      FormConfigCoreModule,
    ) as Array<unknown>;
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      FormConfigCoreModule,
    ) as Array<unknown>;

    expect(providers).toContain(FormConfigService);
    expect(exports).toContain(FormConfigService);
  });
});
