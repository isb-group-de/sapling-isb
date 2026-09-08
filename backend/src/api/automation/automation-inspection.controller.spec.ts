import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { AdminPermissionGuard } from '../../auth/guard/admin-permission.guard';
import { AutomationInspectionController } from './automation-inspection.controller';
import { AiPromptController } from '../ai/prompts/ai-prompt.controller';
import { AiEvaluationController } from '../ai/ai-evaluation.controller';

describe('Administration-only inspection APIs', () => {
  it.each([
    AutomationInspectionController,
    AiPromptController,
    AiEvaluationController,
  ])('denies direct calls from non-administrators (%p)', (controller) => {
    const guard = new AdminPermissionGuard(new Reflector());
    const context = {
      getClass: () => controller,
      getHandler: () => () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [{ isAdministrator: false }] } }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

jest.mock('../ai/ai-evaluation.service', () => ({
  AiEvaluationService: class {},
}));
