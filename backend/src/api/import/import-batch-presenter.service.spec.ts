import { ImportBatchItem } from '../../entity/ImportBatchItem';
import { ImportBatchRowItem } from '../../entity/ImportBatchRowItem';
import { ImportBatchPresenterService } from './import-batch-presenter.service';

describe('ImportBatchPresenterService', () => {
  const service = new ImportBatchPresenterService();

  it('maps batch counters, relations, result summary, and rows', () => {
    const batch = Object.assign(new ImportBatchItem(), {
      handle: 42,
      status: 'validatedWithErrors',
      filename: 'companies.csv',
      source: { handle: 'erp' },
      targetEntity: { handle: 'company' },
      importTemplate: { handle: 11 },
      rowCount: 3,
      processedCount: 3,
      readyCount: 2,
      errorCount: 1,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      headers: ['Name'],
      sampleRows: [],
    });
    const row = Object.assign(new ImportBatchRowItem(), {
      handle: 9,
      rowNumber: 2,
      status: 'error',
      rawData: { Name: '' },
      message: 'import.requiredFieldMissing',
    });

    const result = service.toBatchSummary(batch, [row]);

    expect(result).toMatchObject({
      handle: 42,
      sourceHandle: 'erp',
      entityHandle: 'company',
      templateHandle: 11,
      resultSummary: {
        totalRows: 3,
        processedRows: 3,
        readyRows: 2,
        errorRows: 1,
      },
      rows: [
        {
          handle: 9,
          rowNumber: 2,
          status: 'error',
          rawData: { Name: '' },
          message: 'import.requiredFieldMissing',
        },
      ],
    });
  });
});
