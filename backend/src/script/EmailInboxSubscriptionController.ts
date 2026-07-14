import { EmailInboxSubscriptionItem } from '../entity/EmailInboxSubscriptionItem.js';
import { ScriptClass } from './core/script.class.js';
import {
  ScriptResultClient,
  ScriptResultClientMethods,
} from './core/script.result.client.js';

export class EmailInboxSubscriptionController extends ScriptClass {
  async execute(items: object[], name: string): Promise<ScriptResultClient> {
    if (name !== 'synchronizeEmailInbox') {
      return super.execute(items, name);
    }

    if (![...this.user.roles].some((role) => role.isAdministrator === true)) {
      throw new Error('global.permissionDenied');
    }
    if (!this.emailInboxSyncService) {
      throw new Error('emailInbox.processingServiceUnavailable');
    }

    const item = items[0] as EmailInboxSubscriptionItem | undefined;
    const handle = Number(item?.handle);
    if (!Number.isInteger(handle) || handle <= 0) {
      throw new Error('emailInboxSubscription.handleRequired');
    }

    await this.emailInboxSyncService.enqueueSubscriptionNow(handle);

    const result = new ScriptResultClient(
      ScriptResultClientMethods.showMessage,
      true,
      JSON.stringify({
        message: 'emailInboxSubscription.manualSynchronizationRequested',
        entity: 'emailInboxSubscription',
        technical: { subscriptionHandle: handle },
      }),
    );
    result.item = item ?? {};
    return result;
  }
}
