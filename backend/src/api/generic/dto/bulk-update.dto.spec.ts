import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenericBulkUpdateDto } from './bulk-update.dto';

describe('GenericBulkUpdateDto', () => {
  it('normalizes numeric handles and accepts a valid change set', async () => {
    const dto = plainToInstance(GenericBulkUpdateDto, {
      targets: [{ handle: 42, expectedUpdatedAt: '2026-07-17T08:00:00.000Z' }],
      changes: { isActive: false },
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.targets[0]?.handle).toBe('42');
  });

  it('rejects an empty target selection', async () => {
    const dto = plainToInstance(GenericBulkUpdateDto, {
      targets: [],
      changes: { isActive: false },
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'targets')).toBe(true);
  });

  it('rejects more than 200 targets', async () => {
    const dto = plainToInstance(GenericBulkUpdateDto, {
      targets: Array.from({ length: 201 }, (_, index) => ({
        handle: index + 1,
      })),
      changes: { isActive: false },
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'targets')).toBe(true);
  });
});
