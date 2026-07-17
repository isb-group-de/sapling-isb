import { describe, expect, it } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { IMPERSONATION_READ_ONLY_KEY } from '../../auth/impersonation-read-only';
import { KpiController } from './kpi.controller';

describe('KpiController', () => {
  it('marks batch execution as read-only during impersonation', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<boolean>(
        IMPERSONATION_READ_ONLY_KEY,
        Reflect.get(
          KpiController.prototype,
          'executeKPIBatch',
        ) as () => unknown,
      ),
    ).toBe(true);
  });
});
