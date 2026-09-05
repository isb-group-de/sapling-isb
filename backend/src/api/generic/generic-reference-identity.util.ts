import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

/** Internal identity transfer may rebind structural references. Explicit field
 * permissions and security fields remain enforced by FieldPermissionService. */
export function identityReferenceTemplates(
  templates: EntityTemplateDto[],
  referenceFields: string[] = [],
): EntityTemplateDto[] {
  const fields = new Set(referenceFields);
  return templates.map((field) =>
    fields.has(field.name) &&
    field.isReference &&
    field.options?.includes('isReadOnly') &&
    !field.options.includes('isSecurity')
      ? {
          ...field,
          options: field.options.filter((option) => option !== 'isReadOnly'),
        }
      : field,
  );
}
