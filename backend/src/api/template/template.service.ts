import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { EntityTemplateDto } from './dto/entity-template.dto';
import {
  getSaplingFormLayout,
  getSaplingGenericReference,
  getSaplingInlineCollection,
  getSaplingKanban,
  getSaplingReferenceTemplate,
  getSaplingReferenceDependency,
  getSaplingOptions,
  hasSaplingOption,
} from '../../entity/global/entity.decorator';

// Mapping of entity handles to their classes
const entityMap = ENTITY_MAP ?? {};
const entityHandleByTypeName = new Map<string, string>(
  Object.entries(entityMap).flatMap(([entityHandle, entityClass]) => {
    const typeName = (entityClass as { name?: string } | undefined)?.name;
    return typeName ? [[typeName, entityHandle]] : [];
  }),
);

function isGeneratedInverseRelation(prop: {
  kind?: string | null;
  name: string;
  persist?: boolean;
}): boolean {
  return (
    prop.persist === false &&
    ['1:m', 'm:n', 'n:m'].includes(prop.kind ?? '') &&
    prop.name.endsWith('_inverse')
  );
}

function assertHandlePrimaryKeyInvariant(
  entityHandle: string,
  properties: Array<{
    name: string;
    primary?: boolean;
  }>,
): void {
  const primaryKeys = properties.filter(
    (property) => property.primary === true,
  );
  if (primaryKeys.length !== 1 || primaryKeys[0].name !== 'handle') {
    throw new Error(
      `Invalid entity metadata for "${entityHandle}": expected exactly one primary key named "handle".`,
    );
  }
}

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service for retrieving entity template metadata.
 *
 * @property        em                   EntityManager for metadata access
 * @method          constructor          Injects the EntityManager
 * @method          getEntityTemplate    Returns metadata template for a given entity
 */
@Injectable()
export class TemplateService {
  private static readonly templateCache = new Map<
    string,
    EntityTemplateDto[]
  >();

  /**
   * Injects the MikroORM EntityManager for metadata access.
   * @param em EntityManager instance
   */
  constructor(private readonly em: EntityManager) {}

  /**
   * Returns the metadata template for a given entity.
   * @param entityHandle The name of the entity
   * @returns Array of EntityTemplateDto objects describing the entity's properties
   */
  getEntityTemplate(entityHandle: string): EntityTemplateDto[] {
    const cachedTemplate = TemplateService.templateCache.get(entityHandle);
    if (cachedTemplate) {
      return [...cachedTemplate];
    }

    // Ensure entityMap[entityHandle] is defined and is a class constructor
    const entityClass = entityMap[entityHandle] as
      { name?: string } | undefined;
    if (!entityClass || typeof entityClass !== 'function') {
      throw new Error('global.entityNotFound');
    }
    const meta = this.em.getMetadata().get(entityClass);

    const properties = Object.values(meta.properties);
    assertHandlePrimaryKeyInvariant(entityHandle, properties);

    const template = properties
      .filter((prop) => !isGeneratedInverseRelation(prop))
      .map((prop) => {
        const isReadOnly = hasSaplingOption(
          entityClass.prototype as object,
          prop.name,
          'isReadOnly',
        );
        const formLayout = getSaplingFormLayout(
          entityClass.prototype as object,
          prop.name,
        );
        const isCollectionRelation = ['m:n', '1:m'].includes(prop.kind ?? '');
        const isBooleanField = prop.type === 'boolean';
        const hasExplicitDefault =
          prop.default !== undefined || prop.defaultRaw != null;
        const isRequiredPrimaryKey =
          (prop.primary ?? false) && !(prop.autoincrement ?? false);

        const entityHandleFromType =
          entityHandleByTypeName.get(prop.type) ?? null;

        return {
          name: prop.name,
          type: prop.type,
          referenceName: entityHandleFromType ?? '',
          length: prop.length ?? null,
          nullable: prop.nullable ?? true,
          default: prop.default ?? (isBooleanField ? false : null),
          defaultRaw: prop.defaultRaw
            ? String(prop.defaultRaw).replace(/^['"]|['"]$/g, '')
            : null,
          isAutoIncrement: prop.autoincrement ?? false,
          kind: prop.kind ?? null,
          mappedBy: prop.mappedBy ?? null,
          inversedBy: prop.inversedBy ?? null,
          isUnique: prop.unique == true,
          isPersistent: prop.persist ?? true,
          isReference: ['m:n', '1:m', '1:1', 'm:1'].includes(prop.kind ?? ''),
          isRequired:
            !isBooleanField &&
            !isReadOnly &&
            !isCollectionRelation &&
            !hasExplicitDefault &&
            (isRequiredPrimaryKey ||
              (!(prop.nullable ?? true) && !(prop.autoincrement ?? false))),
          options: getSaplingOptions(
            entityClass.prototype as object,
            prop.name,
          ),
          formGroup: formLayout.group,
          formGroupOrder: formLayout.groupOrder,
          formOrder: formLayout.order,
          formWidth: formLayout.width,
          formVisible: formLayout.formVisible,
          tableOrder: formLayout.tableOrder,
          tableVisible: formLayout.tableVisible,
          mobileOrder: formLayout.mobileOrder,
          mobileVisible: formLayout.mobileVisible,
          referenceDependency: getSaplingReferenceDependency(
            entityClass.prototype as object,
            prop.name,
          ),
          genericReference: getSaplingGenericReference(
            entityClass.prototype as object,
            prop.name,
          ),
          referenceTemplate: getSaplingReferenceTemplate(
            entityClass.prototype as object,
            prop.name,
          ),
          inlineCollection: getSaplingInlineCollection(
            entityClass.prototype as object,
            prop.name,
          ),
          kanban: getSaplingKanban(entityClass.prototype as object, prop.name),
        };
      });

    TemplateService.templateCache.set(entityHandle, template);
    return [...template];
  }
}
