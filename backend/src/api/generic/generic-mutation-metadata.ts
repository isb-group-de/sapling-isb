import type { EntityTemplateDto } from '../template/dto/entity-template.dto';

/** Owned by one internal batch only. It must never be accepted from a request DTO. */
export class GenericMutationMetadata {
  private readonly templates = new Map<string, Promise<EntityTemplateDto[]>>();
  getTemplates(
    entity: string,
    load: () => Promise<EntityTemplateDto[]>,
  ): Promise<EntityTemplateDto[]> {
    let pending = this.templates.get(entity);
    if (!pending) {
      pending = load();
      this.templates.set(entity, pending);
    }
    return pending;
  }
}
