import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import {
  GENERIC_LIST_DEFAULT_LIMIT,
  GENERIC_LIST_MAX_LIMIT,
} from '../../../constants/project.constants';
import { DownloadQueryDto, PaginatedQueryDto } from './query.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
});

describe('generic query DTOs', () => {
  it('defaults paginated generic reads to 100 entries', async () => {
    const result = (await pipe.transform(
      {},
      {
        type: 'query',
        metatype: PaginatedQueryDto,
      },
    )) as PaginatedQueryDto;

    expect(result.page).toBe(1);
    expect(result.limit).toBe(GENERIC_LIST_DEFAULT_LIMIT);
  });

  it('accepts the maximum generic page size', async () => {
    const result = (await pipe.transform(
      { limit: String(GENERIC_LIST_MAX_LIMIT) },
      {
        type: 'query',
        metatype: PaginatedQueryDto,
      },
    )) as PaginatedQueryDto;

    expect(result.limit).toBe(GENERIC_LIST_MAX_LIMIT);
  });

  it('rejects generic page sizes above 100', async () => {
    await expect(
      pipe.transform(
        { limit: String(GENERIC_LIST_MAX_LIMIT + 1) },
        {
          type: 'query',
          metatype: PaginatedQueryDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps export queries independent from list pagination', async () => {
    const result = (await pipe.transform(
      {
        limit: '200',
        filter: '{"isActive":true}',
        relations: 'status',
      },
      {
        type: 'query',
        metatype: DownloadQueryDto,
      },
    )) as DownloadQueryDto & { limit?: number };

    expect(result).not.toHaveProperty('limit');
    expect(result.filter).toEqual({ isActive: true });
    expect(result.relations).toEqual(['status']);
  });
});
