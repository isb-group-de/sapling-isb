import { InternalCaseItem } from '../entity/InternalCaseItem.js';
import { ScriptClass } from './core/script.class.js';
import {
  ScriptResultServer,
  ScriptResultServerMethods,
} from './core/script.result.server.js';

export class InternalCaseController extends ScriptClass {
  async afterInsert(items: InternalCaseItem[]): Promise<ScriptResultServer> {
    await this.sleep(0);

    for (const internalCase of items) {
      internalCase.number =
        `IC-${internalCase.createdAt?.getFullYear() ?? new Date().getFullYear()}-` +
        (internalCase.handle ?? 0).toString().padStart(5, '0');
    }

    return new ScriptResultServer(items, ScriptResultServerMethods.overwrite);
  }
}
