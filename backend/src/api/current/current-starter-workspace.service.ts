import type { EntityManager } from '@mikro-orm/core';
import { DashboardItem } from '../../entity/DashboardItem';
import type { DashboardTemplateItem } from '../../entity/DashboardTemplateItem';
import { FavoriteItem } from '../../entity/FavoriteItem';
import type { FavoriteTemplateItem } from '../../entity/FavoriteTemplateItem';
import type { KpiItem } from '../../entity/KpiItem';
import { PersonItem } from '../../entity/PersonItem';
import type { RoleItem } from '../../entity/RoleItem';

export class CurrentStarterWorkspaceService {
  async ensure(em: EntityManager, personHandle: number): Promise<void> {
    const person = await em.findOne(
      PersonItem,
      { handle: personHandle },
      {
        populate: [
          'roles',
          'roles.starterDashboardTemplates',
          'roles.starterDashboardTemplates.kpis',
          'roles.starterFavoriteTemplates',
          'roles.starterFavoriteTemplates.entity',
          'roles.starterFavoriteTemplates.entityRoute',
        ],
      },
    );
    if (!person) return;

    const dashboardTemplates = this.collectDashboardTemplates(person);
    const favoriteTemplates = this.collectFavoriteTemplates(person);
    if (dashboardTemplates.length === 0 && favoriteTemplates.length === 0) {
      return;
    }

    const [dashboardCount, favoriteCount] = await Promise.all([
      dashboardTemplates.length > 0
        ? em.count(DashboardItem, { person: { handle: personHandle } })
        : Promise.resolve(0),
      favoriteTemplates.length > 0
        ? em.count(FavoriteItem, { person: { handle: personHandle } })
        : Promise.resolve(0),
    ]);
    const dashboards =
      dashboardCount === 0
        ? dashboardTemplates.map((template, index) =>
            this.createDashboard(person, template, index),
          )
        : [];
    const favorites =
      favoriteCount === 0
        ? favoriteTemplates.map((template) =>
            this.createFavorite(person, template),
          )
        : [];

    if (dashboards.length === 0 && favorites.length === 0) return;
    dashboards.forEach((dashboard) => em.persist(dashboard));
    favorites.forEach((favorite) => em.persist(favorite));
    await em.flush();
  }

  private collectDashboardTemplates(
    person: PersonItem,
  ): DashboardTemplateItem[] {
    return this.getUniqueTemplates(
      this.getCollectionItems<RoleItem>(person.roles).flatMap((role) =>
        this.getCollectionItems(role.starterDashboardTemplates),
      ),
    );
  }

  private collectFavoriteTemplates(person: PersonItem): FavoriteTemplateItem[] {
    return this.getUniqueTemplates(
      this.getCollectionItems<RoleItem>(person.roles).flatMap((role) =>
        this.getCollectionItems(role.starterFavoriteTemplates),
      ),
    );
  }

  private createDashboard(
    person: PersonItem,
    template: DashboardTemplateItem,
    index: number,
  ): DashboardItem {
    const dashboard = new DashboardItem();
    dashboard.name = template.name;
    dashboard.person = person;
    dashboard.sortOrder = (index + 1) * 100;
    const kpis = this.getCollectionItems<KpiItem>(template.kpis);
    dashboard.kpiOrder = kpis.flatMap((kpi) =>
      kpi.handle == null ? [] : [kpi.handle],
    );
    kpis.forEach((kpi) => dashboard.kpis.add(kpi));
    return dashboard;
  }

  private createFavorite(
    person: PersonItem,
    template: FavoriteTemplateItem,
  ): FavoriteItem {
    const favorite = new FavoriteItem();
    favorite.title = template.name;
    favorite.person = person;
    favorite.entity = template.entity;
    favorite.entityRoute = template.entityRoute;
    favorite.filter = cloneJsonValue(template.filter);
    return favorite;
  }

  private getCollectionItems<T>(value: unknown): T[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'object' && 'getItems' in value) {
      const getItems = (value as { getItems?: () => unknown }).getItems;
      if (typeof getItems === 'function') {
        const items = getItems.call(value) as unknown;
        return Array.isArray(items) ? (items as T[]) : [];
      }
    }
    if (typeof (value as Iterable<T>)[Symbol.iterator] === 'function') {
      return Array.from(value as Iterable<T>);
    }
    return [];
  }

  private getUniqueTemplates<T extends { handle?: number; name?: string }>(
    templates: T[],
  ): T[] {
    const seenKeys = new Set<string>();
    return templates.filter((template) => {
      const key =
        template.handle != null
          ? `handle:${template.handle}`
          : `name:${template.name ?? ''}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }
}

function cloneJsonValue<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}
