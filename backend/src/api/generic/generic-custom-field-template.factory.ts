import { CustomFieldDefinitionItem } from '../../entity/CustomFieldDefinitionItem';
import { type CustomFieldType } from '../../entity/CustomFieldTypeItem';
import { EntityTemplateDto } from '../template/dto/entity-template.dto';
import type { SaplingFormRenderer } from '../form-config/form-config.types';
import { CUSTOM_FIELD_TEMPLATE_PREFIX } from './generic-custom-field.types';

export function createCustomFieldTemplate(
  definition: CustomFieldDefinitionItem,
): EntityTemplateDto {
  const template = new EntityTemplateDto();
  const fieldType = getDefinitionFieldType(definition);
  const type = getTemplateType(fieldType);
  const isRequired =
    !definition.isReadOnly && fieldType !== 'boolean' && definition.isRequired;

  template.name = `${CUSTOM_FIELD_TEMPLATE_PREFIX}${definition.fieldKey}`;
  template.type = type;
  template.length = fieldType === 'text' ? 255 : null;
  template.default = fieldType === 'boolean' ? false : null;
  template.isAutoIncrement = false;
  template.kind = null;
  template.mappedBy = null;
  template.inversedBy = null;
  template.isUnique = false;
  template.referenceName = '';
  template.isReference = false;
  template.isRequired = isRequired;
  template.nullable = !isRequired;
  template.isPersistent = true;
  template.options = fieldType === 'longText' ? ['isMarkdown'] : [];
  if (definition.isReadOnly) {
    template.options.push('isReadOnly');
  }
  template.formGroup = 'Custom fields';
  template.formGroupOrder = 900;
  template.formOrder = definition.fieldOrder;
  template.formWidth = fieldType === 'longText' ? 4 : 2;
  template.formVisible = definition.formVisible;
  template.tableOrder = definition.fieldOrder;
  template.tableVisible = definition.tableVisible;
  template.mobileOrder = definition.fieldOrder;
  template.mobileVisible = definition.mobileVisible;
  template.formConfig = {
    label: definition.label,
    helpText: definition.tooltip?.trim() || null,
    required: isRequired,
    renderer: getRenderer(fieldType),
    metadata: {
      customField: {
        key: definition.fieldKey,
        type: fieldType,
        options: definition.selectOptions ?? [],
      },
    },
  };

  (template as EntityTemplateDto & { customField?: object }).customField = {
    key: definition.fieldKey,
    type: fieldType,
    options: definition.selectOptions ?? [],
    tooltip: definition.tooltip?.trim() || null,
  };

  return template;
}

function getTemplateType(fieldType: CustomFieldType): string {
  switch (fieldType) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'DateType';
    case 'dateTime':
      return 'datetime';
    case 'multiSelect':
      return 'JsonType';
    case 'longText':
    case 'select':
    case 'text':
    default:
      return 'string';
  }
}

function getRenderer(fieldType: CustomFieldType): SaplingFormRenderer | null {
  switch (fieldType) {
    case 'longText':
      return 'longText';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'dateTime':
      return 'dateTime';
    case 'select':
      return 'select';
    case 'multiSelect':
      return 'multiSelect';
    case 'text':
    default:
      return 'shortText';
  }
}

function getDefinitionFieldType(
  definition: CustomFieldDefinitionItem,
): CustomFieldType {
  const value = definition.fieldType;
  const handle =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String(value.handle ?? '')
        : '';

  return isCustomFieldType(handle) ? handle : 'text';
}

function isCustomFieldType(value: string): value is CustomFieldType {
  return [
    'text',
    'longText',
    'number',
    'boolean',
    'date',
    'dateTime',
    'select',
    'multiSelect',
  ].includes(value);
}
