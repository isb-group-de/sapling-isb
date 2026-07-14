import { DvelopConfigurationService } from '../api/document/dvelop-configuration.service';
import { DvelopConnectionItem } from '../entity/DvelopConnectionItem';
import { ScriptClass } from './core/script.class.js';
import {
  ScriptResultClient,
  ScriptResultClientMethods,
} from './core/script.result.client.js';
import {
  ScriptResultServer,
  ScriptResultServerMethods,
} from './core/script.result.server.js';

type DvelopSyncAction = {
  payload: {
    repositories?: boolean;
    objectDefinitions?: boolean;
    properties?: boolean;
  };
  message: string;
};

const DVELOP_SYNC_ACTIONS: Record<string, DvelopSyncAction> = {
  syncRepositories: {
    payload: { repositories: true },
    message: 'dvelopCloud.repositoriesSynced',
  },
  syncObjectDefinitions: {
    payload: { objectDefinitions: true },
    message: 'dvelopCloud.objectDefinitionsSynced',
  },
  syncProperties: {
    payload: { properties: true },
    message: 'dvelopCloud.propertiesSynced',
  },
};

export class DvelopConnectionController extends ScriptClass {
  beforeUpdate(items: DvelopConnectionItem[]): Promise<ScriptResultServer> {
    for (const item of items) {
      if (item.apiKey == null || item.apiKey.trim() === '') {
        delete item.apiKey;
      }
    }

    return Promise.resolve(
      new ScriptResultServer(items, ScriptResultServerMethods.overwrite),
    );
  }

  async execute(items: object[], name: string): Promise<ScriptResultClient> {
    const action = DVELOP_SYNC_ACTIONS[name];
    if (!action) {
      return super.execute(items, name);
    }

    const item = this.requireSingleItem(items);
    const handle = this.requireNumericHandle(item);
    const service = new DvelopConfigurationService(this.requireEntityManager());
    const syncResult = await service.syncConfiguration(handle, action.payload);
    const result = new ScriptResultClient(
      ScriptResultClientMethods.showMessage,
      true,
      JSON.stringify({
        message: action.message,
        description: [
          this.formatSummary('Repositories', syncResult.repositories),
          this.formatSummary('Kategorien', syncResult.objectDefinitions),
          this.formatSummary('Eigenschaften', syncResult.properties),
        ].join(' / '),
        entity: 'dvelopCloud',
        technical: syncResult,
      }),
    );
    result.item = item;

    return result;
  }

  private requireEntityManager() {
    if (!this.em) {
      throw new Error('document.dvelopServiceNotAvailable');
    }

    return this.em;
  }

  private requireSingleItem(items: object[]): Record<string, unknown> {
    const item = items[0];

    if (items.length !== 1 || !item || typeof item !== 'object') {
      throw new Error('script.singleSelectionRequired');
    }

    return item as Record<string, unknown>;
  }

  private requireNumericHandle(item: Record<string, unknown>): number {
    const handle =
      typeof item.handle === 'number' ? item.handle : Number(item.handle);

    if (!Number.isFinite(handle)) {
      throw new Error('global.invalidPayload');
    }

    return handle;
  }

  private formatSummary(
    label: string,
    summary: {
      total: number;
      created: number;
      updated: number;
      skipped: number;
    },
  ): string {
    return `${label}: ${summary.total} gelesen, ${summary.created} neu, ${summary.updated} aktualisiert, ${summary.skipped} uebersprungen`;
  }
}
