import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { PersonItem } from '../../entity/PersonItem';
import { ImportExecutionService } from './import-execution.service';

describe('ImportExecutionService', () => {
  function createScenario(createResult: unknown = { handle: 91 }) {
    const batch = Object.assign(new ImportBatchItem(), {
      handle: 42,
      status: 'executionQueued',
      targetEntity: { handle: 'company' },
      source: null,
      processedCount: 7,
      createdCount: 7,
      updatedCount: 7,
      skippedCount: 7,
      failedCount: 7,
    });
    const readyRow = Object.assign(new ImportBatchRowItem(), {
      rowNumber: 2,
      status: 'ready',
      payload: { name: 'Acme' },
    });
    const pendingRow = Object.assign(new ImportBatchRowItem(), {
      rowNumber: 3,
      status: 'pending',
      payload: null,
    });
    const currentUser = Object.assign(new PersonItem(), { handle: 7 });
    const flush = jest.fn(() => Promise.resolve());
    const em = {
      findOne: jest.fn((entity: unknown) =>
        Promise.resolve(entity === ImportBatchItem ? batch : currentUser),
      ),
      find: jest.fn(() => Promise.resolve([readyRow, pendingRow])),
      flush,
      persist: jest.fn(),
    };
    const genericService = {
      create: jest.fn(() => Promise.resolve(createResult)),
      update: jest.fn(),
    };
    const service = new ImportExecutionService(
      em as never,
      genericService as never,
    );

    return {
      service,
      batch,
      readyRow,
      pendingRow,
      currentUser,
      em,
      genericService,
    };
  }

  async function processInContext(
    service: ImportExecutionService,
  ): Promise<void> {
    await (
      service as unknown as {
        processQueuedExecutionInContext(
          handle: number,
          userHandle: number,
        ): Promise<void>;
      }
    ).processQueuedExecutionInContext(42, 7);
  }

  it('executes ready rows and marks non-error rows as skipped', async () => {
    const scenario = createScenario();

    await processInContext(scenario.service);

    expect(scenario.genericService.create).toHaveBeenCalledWith(
      'company',
      { name: 'Acme' },
      scenario.currentUser,
    );
    expect(scenario.readyRow).toMatchObject({
      status: 'executed',
      action: 'created',
      targetReference: '91',
      message: null,
    });
    expect(scenario.pendingRow).toMatchObject({
      status: 'skipped',
      action: 'skipped',
    });
    expect(scenario.batch).toMatchObject({
      status: 'executed',
      currentOperation: null,
      processedCount: 2,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 1,
      failedCount: 0,
    });
  });

  it('keeps processing state consistent when a row write fails', async () => {
    const scenario = createScenario();
    scenario.genericService.create.mockRejectedValueOnce(
      new Error('write failed'),
    );

    await processInContext(scenario.service);

    expect(scenario.readyRow).toMatchObject({
      status: 'failed',
      action: 'failed',
      message: 'write failed',
    });
    expect(scenario.batch).toMatchObject({
      status: 'executedWithErrors',
      processedCount: 2,
      failedCount: 1,
      skippedCount: 1,
    });
  });
});
