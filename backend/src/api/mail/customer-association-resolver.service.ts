import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { CompanyItem } from '../../entity/CompanyItem';
import { PersonItem } from '../../entity/PersonItem';
import { hasSaplingOption } from '../../entity/global/entity.decorator';
import { ENTITY_MAP } from '../../entity/global/entity.registry';
import { TemplateService } from '../template/template.service';

export interface CustomerAssociation {
  company: CompanyItem | null;
  person: PersonItem | null;
}

/** Resolves the customer-side company/person for a generic source record. */
@Injectable()
export class CustomerAssociationResolverService {
  constructor(private readonly templateService: TemplateService) {}

  async resolve(
    em: EntityManager,
    entityHandle: string,
    referenceHandle?: string | number | null,
  ): Promise<CustomerAssociation> {
    if (referenceHandle == null || String(referenceHandle).trim() === '') {
      return { company: null, person: null };
    }

    if (entityHandle === 'company') {
      return {
        company: await em.findOne(CompanyItem, {
          handle: referenceHandle as never,
        }),
        person: null,
      };
    }

    if (entityHandle === 'person') {
      const person = await em.findOne(
        PersonItem,
        { handle: referenceHandle as never },
        { populate: ['company'] },
      );
      return { company: person?.company ?? null, person };
    }

    const entityClass = ENTITY_MAP[entityHandle] as
      (new (...args: never[]) => Record<string, unknown>) | undefined;
    if (!entityClass) {
      return { company: null, person: null };
    }

    const customerFields = this.templateService
      .getEntityTemplate(entityHandle)
      .filter((field) =>
        hasSaplingOption(entityClass.prototype, field.name, 'isCustomer'),
      );
    const companyField = customerFields.find(
      (field) => field.referenceName === 'company',
    )?.name;
    const personField = customerFields.find(
      (field) => field.referenceName === 'person',
    )?.name;
    const populate = [
      companyField,
      personField,
      personField ? `${personField}.company` : null,
    ].filter((value): value is string => Boolean(value));

    if (!companyField && !personField) {
      return { company: null, person: null };
    }

    const record = (await em.findOne(
      entityClass as never,
      { handle: referenceHandle } as never,
      { populate: populate as never[] },
    )) as Record<string, unknown> | null;
    if (!record) {
      return { company: null, person: null };
    }

    const person = this.asPerson(personField ? record[personField] : null);
    const company =
      this.asCompany(companyField ? record[companyField] : null) ??
      this.asCompany(person?.company);

    return { company, person };
  }

  private asCompany(value: unknown): CompanyItem | null {
    return value instanceof CompanyItem ? value : null;
  }

  private asPerson(value: unknown): PersonItem | null {
    return value instanceof PersonItem ? value : null;
  }
}
