import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import { identityReferenceTemplates } from './generic-reference-identity.util';

describe('internal reference identity templates', () => {
  const actor = Object.assign(new EntityTemplateDto(), {
    name: 'actor',
    isReference: true,
    options: ['isReadOnly', 'isPerson'],
  });

  it('leaves normal client updates read-only', () => {
    expect(identityReferenceTemplates([actor])[0]).toBe(actor);
  });

  it('permits only explicitly identified references without mutating shared metadata', () => {
    const result = identityReferenceTemplates([actor], ['actor']);
    expect(result[0].options).toEqual(['isPerson']);
    expect(actor.options).toEqual(['isReadOnly', 'isPerson']);
    expect(identityReferenceTemplates([actor], ['other'])[0]).toBe(actor);
  });

  it('does not unlock scalar or security fields', () => {
    const scalar = Object.assign(new EntityTemplateDto(), {
      name: 'secret',
      options: ['isReadOnly'],
    });
    const security = Object.assign(new EntityTemplateDto(), {
      name: 'token',
      isReference: true,
      options: ['isReadOnly', 'isSecurity'],
    });
    expect(
      identityReferenceTemplates([scalar, security], ['secret', 'token']),
    ).toEqual([scalar, security]);
  });
});
