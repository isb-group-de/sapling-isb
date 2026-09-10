import { BadRequestException } from '@nestjs/common';
import type { DashboardWidget } from './dashboard-widget.types';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function integer(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}
function text(value: unknown, max: number, empty = false): value is string {
  return (
    typeof value === 'string' &&
    value.length <= max &&
    (empty || value.trim().length > 0)
  );
}
function validFilter(value: unknown): boolean {
  if (!record(value)) return false;
  const json = JSON.stringify(value);
  return (
    json.length <= 20000 &&
    !/"(?:__proto__|constructor|prototype)"\s*:/.test(json)
  );
}
export function isDashboardWebsiteUrl(value: unknown): boolean {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Shared by ORM mutations and the current-user layout endpoint. */
export function validateDashboardWidgets(
  value: unknown,
): asserts value is DashboardWidget[] {
  const fail = () => {
    throw new BadRequestException('dashboard.invalidWidget');
  };
  if (!Array.isArray(value) || value.length > 100) return fail();
  const ids = new Set<string>();
  for (const widget of value as unknown[]) {
    if (
      !record(widget) ||
      !text(widget.id, 80) ||
      !/^[a-zA-Z0-9_-]+$/.test(widget.id) ||
      ids.has(widget.id) ||
      !text(widget.title, 128) ||
      !integer(widget.columns, 1, 4) ||
      !integer(widget.rows, 1, 4) ||
      !record(widget.config)
    )
      return fail();
    ids.add(widget.id);
    const config = widget.config;
    switch (widget.kind) {
      case 'AI':
        if (
          Object.keys(config).some(
            (key) =>
              ![
                'agentHandle',
                'providerHandle',
                'modelHandle',
                'instruction',
              ].includes(key),
          )
        )
          return fail();
        if (
          (config.agentHandle != null && !text(config.agentHandle, 64)) ||
          (config.providerHandle != null && !text(config.providerHandle, 64)) ||
          (config.modelHandle != null && !text(config.modelHandle, 128)) ||
          (config.instruction != null && !text(config.instruction, 8000, true))
        )
          return fail();
        break;
      case 'KPI':
        if (!integer(config.kpiHandle, 1, Number.MAX_SAFE_INTEGER))
          return fail();
        break;
      case 'AGENDA':
        if (
          !validFilter(config.filter) ||
          !integer(config.days, 1, 365) ||
          !integer(config.limit, 1, 50)
        )
          return fail();
        break;
      case 'TABLE':
        if (
          !text(config.entity, 128) ||
          !/^[a-zA-Z][a-zA-Z0-9]*$/.test(config.entity) ||
          !validFilter(config.filter) ||
          !text(config.search, 256, true) ||
          !integer(config.pageSize, 1, 100) ||
          !Array.isArray(config.columns) ||
          config.columns.length > 50 ||
          !config.columns.every((col) => text(col, 128)) ||
          !Array.isArray(config.sortBy) ||
          config.sortBy.length > 10 ||
          !config.sortBy.every(
            (sort) =>
              record(sort) &&
              text(sort.key, 128) &&
              (sort.order === 'asc' || sort.order === 'desc'),
          )
        )
          return fail();
        break;
      case 'WEBSITE':
        if (
          !isDashboardWebsiteUrl(config.url) ||
          !['link', 'embed'].includes(String(config.mode))
        )
          return fail();
        break;
      case 'NOTE':
        if (!text(config.markdown, 20000, true)) return fail();
        break;
      case 'ACTIONS': {
        if (
          !Array.isArray(config.actions) ||
          !integer(config.actions.length, 1, 12)
        )
          return fail();
        const actionIds = new Set<string>();
        for (const action of config.actions) {
          if (
            !record(action) ||
            !text(action.id, 80) ||
            !/^[a-zA-Z0-9_-]+$/.test(action.id) ||
            actionIds.has(action.id) ||
            !text(action.entity, 128) ||
            !/^[a-zA-Z][a-zA-Z0-9]*$/.test(action.entity) ||
            !text(action.label, 128)
          )
            return fail();
          actionIds.add(action.id);
        }
        break;
      }
      default:
        return fail();
    }
  }
}
