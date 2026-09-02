export type KpiWhere = Record<string, unknown>;

export function normalizeKpiWhere(where: object): KpiWhere {
  if (where && typeof where === 'object' && !Array.isArray(where)) {
    return { ...(where as KpiWhere) };
  }

  return {};
}

export function combineKpiWhere(
  baseWhere: object,
  extraWhere: KpiWhere,
): KpiWhere {
  const normalizedBase = normalizeKpiWhere(baseWhere);

  if (Object.keys(extraWhere).length === 0) {
    return normalizedBase;
  }

  if (Object.keys(normalizedBase).length === 0) {
    return { ...extraWhere };
  }

  return { $and: [normalizedBase, extraWhere] };
}
