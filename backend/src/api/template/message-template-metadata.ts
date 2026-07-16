import { TemplateService } from './template.service';

type TemplateField = ReturnType<TemplateService['getEntityTemplate']>[number];

export class MessageTemplateMetadata {
  private readonly templateFieldCache = new Map<
    string,
    Map<string, TemplateField>
  >();

  constructor(private readonly templateService: TemplateService) {}

  collectPopulateRelations(
    entityHandle: string,
    relationExpressions: string[],
  ): string[] {
    return [
      ...new Set(
        relationExpressions.flatMap((expression) =>
          this.collectPopulateRelationsFromExpression(entityHandle, expression),
        ),
      ),
    ];
  }

  resolveExpressionFieldType(
    entityHandle: string,
    expression: string,
  ): string | undefined {
    const field = this.resolveExpressionField(entityHandle, expression);
    return typeof field?.type === 'string' ? field.type : undefined;
  }

  private resolveExpressionField(
    entityHandle: string,
    expression: string,
  ): TemplateField | undefined {
    const segments = splitExpression(expression);
    if (segments.length === 0) {
      return undefined;
    }

    let currentEntityHandle = entityHandle;
    let currentIndex = 0;
    if (segments[0] === 'currentUser') {
      currentEntityHandle = 'person';
      currentIndex = 1;
    }

    let field: TemplateField | undefined;
    for (; currentIndex < segments.length; currentIndex += 1) {
      field = this.getTemplateField(
        currentEntityHandle,
        segments[currentIndex],
      );
      if (!field) {
        return undefined;
      }

      if (currentIndex < segments.length - 1) {
        if (!field.isReference || !field.referenceName) {
          return undefined;
        }
        currentEntityHandle = field.referenceName;
      }
    }

    return field;
  }

  private collectPopulateRelationsFromExpression(
    entityHandle: string,
    expression: string,
  ): string[] {
    const segments = splitExpression(expression);
    if (segments.length === 0) {
      return [];
    }

    const populatePaths: string[] = [];
    const currentPath: string[] = [];
    let currentEntityHandle = entityHandle;

    for (const segment of segments) {
      const field = this.getTemplateField(currentEntityHandle, segment);
      if (!field?.isReference || !field.referenceName) {
        break;
      }

      currentPath.push(segment);
      populatePaths.push(currentPath.join('.'));
      currentEntityHandle = field.referenceName;
    }

    return populatePaths;
  }

  private getTemplateField(
    entityHandle: string,
    fieldName: string,
  ): TemplateField | undefined {
    let fieldMap = this.templateFieldCache.get(entityHandle);
    if (!fieldMap) {
      fieldMap = new Map(
        this.templateService
          .getEntityTemplate(entityHandle)
          .map((field) => [field.name, field] as const),
      );
      this.templateFieldCache.set(entityHandle, fieldMap);
    }
    return fieldMap.get(fieldName);
  }
}

function splitExpression(expression: string): string[] {
  return expression
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
}
