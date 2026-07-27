import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENTITY_REGISTRY } from './entity.registry';
import { getSaplingFormLayout, hasSaplingOption } from './entity.decorator';

interface ReferenceDisplayTranslation {
  entity: string;
  property: string;
  de: string;
  en: string;
}

interface DisplayFieldExpectation {
  referenceProperty: string;
  valueProperty: 'name' | 'firstName' | 'lastName';
  orderOffset: 1 | 2;
  width: 1 | 2;
}

function loadTranslations(seedType: 'json-production' | 'json-demonstration') {
  return JSON.parse(
    readFileSync(
      join(
        __dirname,
        `../../database/seeder/${seedType}/translation/translationData_014.json`,
      ),
      'utf8',
    ),
  ) as ReferenceDisplayTranslation[];
}

const translations = loadTranslations('json-production');

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
      ENTITY_REGISTRY.map((entry) => [entry.name, entry.class]),
    );
    const companyFields = translations.filter(
      ({ property }) =>
        property.endsWith('Name') &&
        !property.endsWith('FirstName') &&
        !property.endsWith('LastName'),
    );
    const firstNameFields = translations.filter(({ property }) =>
      property.endsWith('FirstName'),
    );
    const lastNameFields = translations.filter(({ property }) =>
      property.endsWith('LastName'),
    );

    expect(companyFields).toHaveLength(19);
    expect(firstNameFields).toHaveLength(43);
    expect(lastNameFields).toHaveLength(43);
    expect(translations).toHaveLength(105);
    expect(
      new Set(
        translations.map(({ entity, property }) => `${entity}:${property}`),
      ),
    ).toHaveProperty('size', 105);
    expect(loadTranslations('json-demonstration')).toEqual(translations);

    for (const translation of translations) {
      const entityClass = entityClasses.get(translation.entity);
      expect(entityClass).toBeDefined();

      const expectation = getDisplayFieldExpectation(translation.property);
      const referenceLayout = getSaplingFormLayout(
        entityClass.prototype,
        expectation.referenceProperty,
      );
      const displayLayout = getSaplingFormLayout(
        entityClass.prototype,
        translation.property,
      );
      const descriptor = Object.getOwnPropertyDescriptor(
        entityClass.prototype,
        translation.property,
      );
      const entitySource = readFileSync(
        join(__dirname, `../${entityClass.name}.ts`),
        'utf8',
      );

      expect(referenceLayout.width).toBe(2);
      expect(referenceLayout.order).not.toBeNull();
      expect(descriptor?.get).toEqual(expect.any(Function));
      expect(entitySource).toMatch(
        new RegExp(
          String.raw`@Property\(\{ persist: false, nullable: true, length: 128 \}\)\s+get ${translation.property}\(`,
        ),
      );
      expect(
        hasSaplingOption(
          entityClass.prototype,
          translation.property,
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

      const marker = `${translation.entity}.${translation.property}`;
      const instance = Object.create(entityClass.prototype) as Record<
        string,
        unknown
      >;
      instance[expectation.referenceProperty] = {
        [expectation.valueProperty]: marker,
      };
      expect(instance[translation.property]).toBe(marker);
    }
  });
});
