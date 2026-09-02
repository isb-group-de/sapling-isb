// Generic seeder for any entity type
import { EntityManager } from '@mikro-orm/core';
import type { EntityName } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { EntityRouteItem } from '../../entity/EntityRouteItem';
import { DashboardTemplateItem } from '../../entity/DashboardTemplateItem';
import { KpiItem } from '../../entity/KpiItem';
import { InboxTemplateItem } from '../../entity/InboxTemplateItem';
import { ENTITY_REGISTRY } from '../../entity/global/entity.registry';
import { getSaplingOptions } from '../../entity/global/entity.decorator';
import { SeedScriptItem } from '../../entity/SeedScriptItem';
import { DB_DATA_SEEDER } from '../../constants/project.constants';
import { getErrorMessage } from '../../common/error.utils';
import { formatSaplingPhoneNumber } from '../../api/common/sapling-phone.util';
import fs from 'fs';
import path from 'path';

const DEFAULT_PARTNER_ROUTE_ENTITIES = new Set([
  'effortEstimate',
  'internalCase',
  'salesOpportunity',
  'ticket',
]);

/**
 * @class
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Generic seeder for any entity type. Handles seeding of entities from JSON scripts, tracks execution status, and logs results.
 *
 * @property        {any}                   entityClass         The entity class to seed (static)
 * @property        {string}                entityHandle          The name of the entity to seed (static)
 *
 * @method          run                     Executes seeding for the specified entity, loading JSON scripts, checking execution status, and persisting new records.
 * @method          for                     Static factory method to create a seeder for a given entity class.
 */
export class GenericSeeder extends Seeder {
  /**
   * The entity class to seed (static).
   * @type {any}
   */
  static entityClass: unknown;

  /**
   * The name of the entity to seed (static).
   * @type {string}
   */
  static entityHandle: string;

  /**
   * Executes seeding for the specified entity.
   * Loads JSON scripts, checks if already executed, creates new records, and logs results.
   * @param {EntityManager} em - MikroORM entity manager
   * @returns {Promise<void>}
   */
  async run(em: EntityManager): Promise<void> {
    const entityClass = (this.constructor as typeof GenericSeeder)
      .entityClass as EntityName<object>;
    const entityHandle = (this.constructor as typeof GenericSeeder)
      .entityHandle;

    // Find all script files for this entity
    const scriptsDir = path.join(
      __dirname,
      `./json-${DB_DATA_SEEDER}/${entityHandle}`,
    );
    if (!fs.existsSync(scriptsDir)) {
      global.log.warn(
        `No scripts directory found for ${entityHandle}: ${scriptsDir}`,
      );
      return;
    }
    const scriptFiles = fs
      .readdirSync(scriptsDir)
      .filter((f) => f.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));
    let skippedScripts = 0;

    for (const scriptFile of scriptFiles) {
      const scriptName = scriptFile;
      // Prüfe Status
      const alreadyRun = await em.findOne(SeedScriptItem, {
        scriptName,
        entityHandle,
        isSuccess: true,
      });
      if (alreadyRun) {
        skippedScripts += 1;
        continue;
      }
      // Lade Daten
      const filePath = path.join(scriptsDir, scriptFile);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent) as object[];
      global.log.info(
        `Seeding ${entityHandle} from script ${scriptName}: ${data.length} records.`,
      );
      try {
        for (const item of data) {
          const seedItem = await this.prepareSeedItem(entityHandle, item, em);
          const updatedExisting = await this.updateExistingSeedItemByHandle(
            entityClass,
            seedItem,
            em,
          );

          if (!updatedExisting) {
            em.create(entityClass, seedItem);
          }
        }
        await em.flush();
        const statusItem = new SeedScriptItem();
        statusItem.scriptName = scriptName;
        statusItem.entityHandle = entityHandle;
        statusItem.executedAt = new Date();
        statusItem.isSuccess = true;
        await em.persist(statusItem).flush();
        global.log.info(
          `Script ${scriptName} for ${entityHandle} executed successfully.`,
        );
      } catch (err) {
        global.log.error(
          `Script ${scriptName} for ${entityHandle} failed: ${getErrorMessage(err)}`,
        );

        if (em.isInTransaction()) {
          throw err;
        }

        const statusItem = new SeedScriptItem();
        statusItem.scriptName = scriptName;
        statusItem.entityHandle = entityHandle;
        statusItem.executedAt = new Date();
        statusItem.isSuccess = false;
        await em.persist(statusItem).flush();
        throw err;
      }
    }

    if (skippedScripts > 0) {
      global.log.info(
        `Skipped ${skippedScripts} already executed seed script(s) for ${entityHandle}.`,
      );
    }
  }

  private async prepareSeedItem(
    entityHandle: string,
    item: object,
    em: EntityManager,
  ): Promise<object> {
    const normalizedItem = this.normalizePhoneSeedFields(item);

    if (entityHandle === 'dashboardTemplate') {
      return this.resolveDashboardTemplateKpis(normalizedItem, em);
    }

    if (entityHandle === 'inboxSubscription') {
      return this.resolveInboxSubscriptionTemplate(normalizedItem, em);
    }

    if (entityHandle !== 'favorite' && entityHandle !== 'favoriteTemplate') {
      return normalizedItem;
    }

    const seedItem = normalizedItem as {
      entity?: string | { handle?: string };
      entityRoute?: number | null;
    };

    if (seedItem.entityRoute != null) {
      return normalizedItem;
    }

    const relatedEntityHandle =
      typeof seedItem.entity === 'string'
        ? seedItem.entity
        : seedItem.entity?.handle;

    if (!relatedEntityHandle) {
      return item;
    }

    const defaultRoute = DEFAULT_PARTNER_ROUTE_ENTITIES.has(relatedEntityHandle)
      ? `partner/${relatedEntityHandle}`
      : `table/${relatedEntityHandle}`;
    const entityRoute = await em.findOne(EntityRouteItem, {
      entity: { handle: relatedEntityHandle },
      route: defaultRoute,
      group: null,
    });

    if (!entityRoute?.handle) {
      return normalizedItem;
    }

    return {
      ...seedItem,
      entityRoute: entityRoute.handle,
    };
  }

  private async resolveInboxSubscriptionTemplate(
    item: object,
    em: EntityManager,
  ): Promise<object> {
    const seedItem = item as { template?: unknown };
    if (typeof seedItem.template !== 'string') return item;
    const template = await em.findOne(InboxTemplateItem, {
      name: seedItem.template,
    });
    if (!template) {
      throw new Error(
        `Inbox subscription seeding failed. Unknown template: ${seedItem.template}`,
      );
    }
    return { ...seedItem, template };
  }

  private async resolveDashboardTemplateKpis(
    item: object,
    em: EntityManager,
  ): Promise<object> {
    const seedItem = item as { kpis?: unknown[] };

    if (!Array.isArray(seedItem.kpis)) {
      return item;
    }

    const resolvedKpis = await Promise.all(
      seedItem.kpis.map(async (kpiReference) => {
        if (typeof kpiReference !== 'string') {
          throw new Error(
            'Dashboard template seeding failed. KPI references must use names.',
          );
        }

        const kpi = await em.findOne(KpiItem, { name: kpiReference });

        if (!kpi) {
          throw new Error(
            `Dashboard template seeding failed. Unknown KPI: ${kpiReference}`,
          );
        }

        return kpi;
      }),
    );

    return {
      ...seedItem,
      kpis: resolvedKpis,
    };
  }

  private normalizePhoneSeedFields(item: object): object {
    const entityClass = (this.constructor as typeof GenericSeeder)
      .entityClass as { prototype?: object };

    if (!entityClass?.prototype || !this.isPlainRecord(item)) {
      return item;
    }

    const seedItem = { ...item };

    for (const [propertyName, value] of Object.entries(seedItem)) {
      if (
        typeof value === 'string' &&
        getSaplingOptions(entityClass.prototype, propertyName).includes(
          'isPhone',
        )
      ) {
        seedItem[propertyName] = formatSaplingPhoneNumber(value);
      }
    }

    return seedItem;
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private async updateExistingSeedItemByHandle(
    entityClass: EntityName<object>,
    item: object,
    em: EntityManager,
  ): Promise<boolean> {
    if (entityClass === EntityRouteItem) {
      const entityRoute = item as {
        entity?: string | { handle?: string };
        group?: string | { handle?: string } | null;
        route?: unknown;
      };
      const relatedEntityHandle =
        typeof entityRoute.entity === 'string'
          ? entityRoute.entity
          : entityRoute.entity?.handle;
      const relatedGroupHandle =
        typeof entityRoute.group === 'string'
          ? entityRoute.group
          : entityRoute.group?.handle;

      if (
        relatedEntityHandle &&
        typeof entityRoute.route === 'string' &&
        entityRoute.route.trim()
      ) {
        const existing = await em.findOne(EntityRouteItem, {
          entity: { handle: relatedEntityHandle },
          route: entityRoute.route,
          group: relatedGroupHandle ? { handle: relatedGroupHandle } : null,
        });

        if (existing) {
          em.assign(existing, item as never);
          return true;
        }
      }
    }

    if (entityClass === DashboardTemplateItem) {
      const dashboardTemplate = item as {
        name?: unknown;
        person?: unknown;
      };

      if (
        typeof dashboardTemplate.name === 'string' &&
        dashboardTemplate.name.trim() &&
        dashboardTemplate.person != null
      ) {
        const existing = await em.findOne(DashboardTemplateItem, {
          name: dashboardTemplate.name,
          person: dashboardTemplate.person as never,
        });

        if (existing) {
          em.assign(existing, item as never);
          return true;
        }
      }
    }

    const seedItem = item as { handle?: unknown };

    if (typeof seedItem.handle !== 'string' || !seedItem.handle.trim()) {
      return false;
    }

    const existing = await em.findOne(entityClass, {
      handle: seedItem.handle,
    });

    if (!existing) {
      return false;
    }

    em.assign(existing, item as never);
    return true;
  }

  /**
   * Static factory method to create a seeder for a given entity class.
   * @param {new (...args: any[]) => E} entityClass - The entity class constructor
   * @returns {typeof GenericSeeder} - A seeder class for the entity
   */
  static for<E extends object>(
    entityClass: EntityName<E>,
  ): typeof GenericSeeder {
    const found = ENTITY_REGISTRY.find((e) => e.class === entityClass);
    if (!found) {
      throw new Error('global.entityNotFound');
    }
    class EntitySeeder extends GenericSeeder {}
    EntitySeeder.entityClass = entityClass;
    EntitySeeder.entityHandle = found.name;
    return EntitySeeder;
  }
}
