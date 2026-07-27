import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENTITY_REGISTRY } from './entity.registry';
import { getSaplingFormLayout, hasSaplingOption } from './entity.decorator';

interface ReferenceDisplayField {
  entity: string;
  property: string;
  source: string;
}

interface DisplayFieldExpectation {
  referenceProperty: string;
  valueProperty: 'name' | 'firstName' | 'lastName';
  orderOffset: 1 | 2;
  width: 1 | 2;
}

interface EntityClass {
  name: string;
  prototype: Record<string, unknown>;
}

const entityRegistry = ENTITY_REGISTRY as unknown as {
  name: string;
  class: EntityClass;
}[];

function getReferenceDisplayFields(): ReferenceDisplayField[] {
  return entityRegistry.flatMap((entry) => {
    const sourcePathCandidates = [
      join(__dirname, `../${entry.class.name}.ts`),
      join(__dirname, `../${entry.class.name.replace(/Item$/, '')}.ts`),
    ];
    const sourcePath = sourcePathCandidates.find((candidate) =>
      existsSync(candidate),
    );
    if (!sourcePath) {
      return [];
    }

    const source = readFileSync(sourcePath, 'utf8');

    return [
      ...source.matchAll(
        /@Property\(\{ persist: false, nullable: true, length: 128 \}\)\s+get ([A-Za-z0-9_]+(?:FirstName|LastName|Name))\(/g,
      ),
    ].map((match) => ({
      entity: entry.name,
      property: match[1],
      source,
    }));
  });
}

function getDisplayFieldExpectation(property: string): DisplayFieldExpectation {
  if (property.endsWith('FirstName')) {
    return {
      referenceProperty: property.slice(0, -'FirstName'.length),
      valueProperty: 'firstName',
      orderOffset: 1,
      width: 1,
    };
  }

  if (property.endsWith('LastName')) {
    return {
      referenceProperty: property.slice(0, -'LastName'.length),
      valueProperty: 'lastName',
      orderOffset: 2,
      width: 1,
    };
  }

  return {
    referenceProperty: property.slice(0, -'Name'.length),
    valueProperty: 'name',
    orderOffset: 1,
    width: 2,
  };
}

describe('company and person reference display fields', () => {
  it('defines read-only non-persisted fields directly after every reference', () => {
    const entityClasses = new Map(
      entityRegistry.map((entry) => [entry.name, entry.class]),
    );
    const referenceDisplayFields = getReferenceDisplayFields();
    const companyFields = referenceDisplayFields.filter(
      ({ property }) =>
        property.endsWith('Name') &&
        !property.endsWith('FirstName') &&
        !property.endsWith('LastName'),
    );
    const firstNameFields = referenceDisplayFields.filter(({ property }) =>
      property.endsWith('FirstName'),
    );
    const lastNameFields = referenceDisplayFields.filter(({ property }) =>
      property.endsWith('LastName'),
    );

    expect(companyFields).toHaveLength(19);
    expect(firstNameFields).toHaveLength(43);
    expect(lastNameFields).toHaveLength(43);
    expect(referenceDisplayFields).toHaveLength(105);
    expect(
      new Set(
        referenceDisplayFields.map(
          ({ entity, property }) => `${entity}:${property}`,
        ),
      ),
    ).toHaveProperty('size', 105);

    for (const displayField of referenceDisplayFields) {
      const entityClass = entityClasses.get(displayField.entity);
      if (!entityClass) {
        throw new Error(`Missing registry class for ${displayField.entity}`);
      }

      const expectation = getDisplayFieldExpectation(displayField.property);
      const referenceLayout = getSaplingFormLayout(
        entityClass.prototype,
        expectation.referenceProperty,
      );
      const displayLayout = getSaplingFormLayout(
        entityClass.prototype,
        displayField.property,
      );
      const descriptor = Object.getOwnPropertyDescriptor(
        entityClass.prototype,
        displayField.property,
      );

      expect(referenceLayout.width).toBe(2);
      expect(referenceLayout.order).not.toBeNull();
      expect(typeof descriptor?.get).toBe('function');
      expect(displayField.source).toMatch(
        new RegExp(
          String.raw`@Property\(\{ persist: false, nullable: true, length: 128 \}\)\s+get ${displayField.property}\(`,
        ),
      );
      expect(
        hasSaplingOption(
          entityClass.prototype,
          displayField.property,
          'isReadOnly',
        ),
      ).toBe(true);
      expect(displayLayout).toMatchObject({
        formVisible: false,
        group: referenceLayout.group,
        groupOrder: referenceLayout.groupOrder,
        mobileVisible: false,
        order: (referenceLayout.order ?? 0) + expectation.orderOffset,
        tableVisible: false,
        width: expectation.width,
      });

      const marker = `${displayField.entity}.${displayField.property}`;
      const instance = Object.create(entityClass.prototype) as Record<
        string,
        unknown
      >;
      instance[expectation.referenceProperty] = {
        [expectation.valueProperty]: marker,
      };
      expect(instance[displayField.property]).toBe(marker);
    }
  });
});
