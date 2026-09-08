import { BadRequestException } from '@nestjs/common';
export interface EvaluationExpectations {
  requiredTools?: string[];
  forbiddenTools?: string[];
  targetEntities?: string[];
  contains?: string[];
  forbiddenText?: string[];
  maxToolCalls?: number;
}
export function evaluateAgentResult(
  expectations: EvaluationExpectations,
  text: string,
  calls: { toolName: string; arguments: Record<string, unknown> }[],
) {
  const failures: string[] = [];
  for (const tool of expectations.requiredTools ?? [])
    if (!calls.some((c) => c.toolName === tool))
      failures.push(`missingTool:${tool}`);
  for (const tool of expectations.forbiddenTools ?? [])
    if (calls.some((c) => c.toolName === tool))
      failures.push(`forbiddenTool:${tool}`);
  for (const part of expectations.contains ?? [])
    if (!text.includes(part)) failures.push(`missingText:${part}`);
  for (const part of expectations.forbiddenText ?? [])
    if (text.includes(part)) failures.push(`forbiddenText:${part}`);
  if (
    expectations.maxToolCalls != null &&
    calls.length > expectations.maxToolCalls
  )
    failures.push('toolCallLimit');
  for (const call of calls) {
    const entity = call.arguments.entityHandle;
    if (entity == null || !expectations.targetEntities) continue;
    if (
      typeof entity !== 'string' ||
      !expectations.targetEntities.includes(entity)
    )
      failures.push(
        `unexpectedEntity:${typeof entity === 'string' ? entity : 'invalid'}`,
      );
  }
  return { passed: failures.length === 0, failures };
}

export function validateExpectations(
  value: Record<string, unknown>,
): EvaluationExpectations {
  const arrays = [
    'requiredTools',
    'forbiddenTools',
    'targetEntities',
    'contains',
    'forbiddenText',
  ];
  for (const [key, entry] of Object.entries(value)) {
    if (
      arrays.includes(key) &&
      Array.isArray(entry) &&
      entry.length <= 100 &&
      entry.every((v) => typeof v === 'string' && v.length <= 4000)
    )
      continue;
    if (
      key === 'maxToolCalls' &&
      Number.isInteger(entry) &&
      Number(entry) >= 0 &&
      Number(entry) <= 50
    )
      continue;
    throw new BadRequestException(`ai.evaluationExpectationInvalid:${key}`);
  }
  return value;
}
