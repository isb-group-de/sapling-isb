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
    draftValues?: Record<string, unknown>,
  ): Promise<CustomerAssociation> {
    if (
      (referenceHandle == null || String(referenceHandle).trim() === '') &&
      !draftValues
    ) {
      return { company: null, person: null };
    }

    if (entityHandle === 'company') {
      return {
        company: await this.resolveCompany(
          em,
          draftValues?.handle ?? referenceHandle,
        ),
        person: null,
      };
    }

    if (entityHandle === 'person') {
      const person = await this.resolvePerson(
        em,
        draftValues?.handle ?? referenceHandle,
      );
      const company = Object.prototype.hasOwnProperty.call(
        draftValues ?? {},
        'company',
      )
        ? await this.resolveCompany(em, draftValues?.company)
        : this.asCompany(person?.company);
      return { company, person };
    }

    const entityClass = ENTITY_MAP[entityHandle] as
      (new (...args: never[]) => Record<string, unknown>) | undefined;
    if (!entityClass) {
      return { company: null, person: null };
    }

    const customerFields = this.templateService
      .getEntityTemplate(entityHandle)
      .filter((field) =>
        hasSaplingOption(
          entityClass.prototype as object,
          field.name,
          'isCustomer',
        ),
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

    const hasReferenceHandle =
      referenceHandle != null && String(referenceHandle).trim() !== '';
    const record = hasReferenceHandle
      ? await em.findOne(
          entityClass as never,
          { handle: referenceHandle },
          { populate: populate as never[] },
        )
      : null;
    if (!record && !draftValues) {
      return { company: null, person: null };
    }

    const context = {
      ...(record ?? {}),
      ...(draftValues ?? {}),
    };
    const person = await this.resolvePerson(
      em,
      personField ? context[personField] : null,
    );
    const company =
      (await this.resolveCompany(
        em,
        companyField ? context[companyField] : null,
      )) ?? this.asCompany(person?.company);

    return { company, person };
  }

  private asCompany(value: unknown): CompanyItem | null {
    return value instanceof CompanyItem ? value : null;
  }

  private asPerson(value: unknown): PersonItem | null {
    return value instanceof PersonItem ? value : null;
  }

  private async resolveCompany(
    em: EntityManager,
    value: unknown,
  ): Promise<CompanyItem | null> {
    const company = this.asCompany(value);
    if (company) {
      return company;
    }

    const handle = this.extractHandle(value);
    return handle == null
      ? null
      : em.findOne(CompanyItem, { handle: handle as never });
  }

  private async resolvePerson(
    em: EntityManager,
    value: unknown,
  ): Promise<PersonItem | null> {
    const person = this.asPerson(value);
    if (person) {
      return person;
    }

    const handle = this.extractHandle(value);
    return handle == null
      ? null
      : em.findOne(
          PersonItem,
          { handle: handle as never },
          { populate: ['company'] },
        );
  }

  private extractHandle(value: unknown): string | number | null {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim() === '' ? null : value;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    return this.extractHandle((value as { handle?: unknown }).handle);
  }
}
