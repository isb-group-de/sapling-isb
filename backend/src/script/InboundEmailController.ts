import { InboundEmailItem } from '../entity/InboundEmailItem.js';
import { ScriptClass } from './core/script.class.js';
import { ScriptResultClient } from './core/script.result.client.js';

export class InboundEmailController extends ScriptClass {
  async execute(items: object[], name: string): Promise<ScriptResultClient> {
    if (name !== 'reprocessInboundEmail') {
      return super.execute(items, name);
    }

    if (!this.emailInboxSyncService) {
      throw new Error('emailInbox.processingServiceUnavailable');
    }

    for (const item of items as InboundEmailItem[]) {
      const handle = Number(item.handle);
      if (!Number.isInteger(handle) || handle <= 0) {
        continue;
      }

      await this.emailInboxSyncService.reprocessInboundEmail(handle);
    }

    return new ScriptResultClient();
  }
}
