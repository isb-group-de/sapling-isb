import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('field-permission response projection architecture', () => {
  it('registers the registered-entity projector as a global interceptor', () => {
    const source = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');

    expect(source).toContain('provide: APP_INTERCEPTOR');
    expect(source).toContain('useClass: FieldPermissionProjectionInterceptor');
  });

  it('keeps TemplateModule independent from CurrentModule', () => {
    const source = readFileSync(
      join(__dirname, '..', 'api', 'template', 'template.module.ts'),
      'utf8',
    );

    expect(source).not.toContain('CurrentModule');
    expect(source).toContain('FieldPermissionService');
  });
});
