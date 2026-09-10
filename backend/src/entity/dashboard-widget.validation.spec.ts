import { describe, expect, it } from '@jest/globals';
import { validateDashboardWidgets } from './dashboard-widget.validation';

const base = { id: 'widget-1', title: 'My widget', columns: 2, rows: 4 };
describe('dashboard widget validation', () => {
  it('accepts a mixed layout and an explicit empty layout', () => {
    expect(() =>
      validateDashboardWidgets([
        {
          ...base,
          id: 'note',
          kind: 'NOTE',
          config: { markdown: '# Notes\n- Item' },
        },
        {
          ...base,
          id: 'actions',
          kind: 'ACTIONS',
          config: {
            actions: [
              { id: 'ticket', label: 'New ticket', entity: 'ticket' },
              { id: 'event', label: 'New event', entity: 'event' },
            ],
          },
        },
        { ...base, kind: 'KPI', config: { kpiHandle: 12 } },
        {
          ...base,
          id: 'agenda',
          kind: 'AGENDA',
          config: { days: 90, limit: 5, filter: { status: 'confirmed' } },
        },
        {
          ...base,
          id: 'table',
          kind: 'TABLE',
          config: {
            entity: 'ticket',
            filter: { status: 'open' },
            columns: ['title'],
            sortBy: [{ key: 'title', order: 'asc' }],
            search: 'abc',
            pageSize: 10,
          },
        },
        {
          ...base,
          id: 'web',
          kind: 'WEBSITE',
          config: { url: 'https://example.com', mode: 'embed' },
        },
      ]),
    ).not.toThrow();
    expect(() => validateDashboardWidgets([])).not.toThrow();
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'http://example.com',
    'https://user:secret@example.com',
  ])('rejects unsafe URL %s', (url) => {
    expect(() =>
      validateDashboardWidgets([
        { ...base, kind: 'WEBSITE', config: { url, mode: 'embed' } },
      ]),
    ).toThrow('dashboard.invalidWidget');
  });
  it('rejects duplicate instances, malformed configs and invalid sizes', () => {
    const value = { ...base, kind: 'KPI', config: { kpiHandle: 1 } };
    for (const widgets of [
      [value, value],
      [{ ...value, rows: 0 }],
      [{ ...value, columns: 5 }],
      [{ ...value, kind: 'UNKNOWN' }],
      [{ ...value, config: { kpiHandle: '1' } }],
    ]) {
      expect(() => validateDashboardWidgets(widgets)).toThrow(
        'dashboard.invalidWidget',
      );
    }
  });
  it('rejects malformed notes and action configurations', () => {
    for (const widget of [
      { kind: 'NOTE', config: { markdown: 7 } },
      { kind: 'NOTE', config: { markdown: 'a'.repeat(20001) } },
      { kind: 'ACTIONS', config: { actions: [] } },
      {
        kind: 'ACTIONS',
        config: { actions: [{ id: 'x', entity: 'ticket', label: '' }] },
      },
      {
        kind: 'ACTIONS',
        config: {
          actions: [{ id: 'x', entity: '../ticket', label: 'Create' }],
        },
      },
      {
        kind: 'ACTIONS',
        config: {
          actions: Array.from({ length: 13 }, (_, i) => ({
            id: `a${i}`,
            entity: 'event',
            label: 'Create',
          })),
        },
      },
      {
        kind: 'ACTIONS',
        config: {
          actions: Array.from({ length: 2 }, () => ({
            id: 'same',
            entity: 'event',
            label: 'Create',
          })),
        },
      },
    ])
      expect(() => validateDashboardWidgets([{ ...base, ...widget }])).toThrow(
        'dashboard.invalidWidget',
      );
  });
});

describe('AI dashboard widgets', () => {
  const widget = {
    id: 'ai-customer',
    title: 'Customer',
    rows: 4,
    columns: 2,
    kind: 'AI',
  };
  it('accepts an optional task and runtime references', () => {
    expect(() =>
      validateDashboardWidgets([
        {
          ...widget,
          config: {
            instruction: 'Prepare customer',
            modelHandle: 'model',
            providerHandle: 'provider',
            agentHandle: 'agent',
          },
        },
      ]),
    ).not.toThrow();
    expect(() =>
      validateDashboardWidgets([{ ...widget, config: {} }]),
    ).not.toThrow();
  });
  it('rejects embedded personal session state and excessive instructions', () => {
    expect(() =>
      validateDashboardWidgets([{ ...widget, config: { sessionHandle: 22 } }]),
    ).toThrow();
    expect(() =>
      validateDashboardWidgets([
        { ...widget, config: { instruction: 'x'.repeat(8001) } },
      ]),
    ).toThrow();
  });
});
