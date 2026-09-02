export function normalizeKpiNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function calculateKpiFormula(
  primaryValue: number | null,
  secondaryValue: number | null,
  operation: string,
  scale: number,
): number | null {
  if (primaryValue === null) return null;

  let value: number;
  switch (operation) {
    case 'ADD':
      if (secondaryValue === null) return null;
      value = primaryValue + secondaryValue;
      break;
    case 'SUBTRACT':
      if (secondaryValue === null) return null;
      value = primaryValue - secondaryValue;
      break;
    case 'MULTIPLY':
      if (secondaryValue === null) return null;
      value = primaryValue * secondaryValue;
      break;
    case 'DIVIDE':
      if (secondaryValue === null || secondaryValue === 0) return null;
      value = primaryValue / secondaryValue;
      break;
    case 'IDENTITY':
      value = primaryValue;
      break;
    default:
      throw new Error(`Unsupported KPI formula operation: ${operation}`);
  }

  const scaled = value * scale;
  return Number.isFinite(scaled) ? scaled : null;
}
