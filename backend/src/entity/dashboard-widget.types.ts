export type DashboardWidgetKind =
  'KPI' | 'AGENDA' | 'TABLE' | 'WEBSITE' | 'NOTE' | 'ACTIONS';
export interface DashboardWidgetBase {
  id: string;
  title: string;
  columns: number;
  rows: number;
}
export type DashboardWidget = DashboardWidgetBase &
  (
    | { kind: 'KPI'; config: { kpiHandle: number } }
    | {
        kind: 'AGENDA';
        config: {
          filter: Record<string, unknown>;
          days: number;
          limit: number;
        };
      }
    | {
        kind: 'TABLE';
        config: {
          entity: string;
          filter: Record<string, unknown>;
          columns: string[];
          sortBy: { key: string; order: 'asc' | 'desc' }[];
          search: string;
          pageSize: number;
        };
      }
    | { kind: 'WEBSITE'; config: { url: string; mode: 'link' | 'embed' } }
    | { kind: 'NOTE'; config: { markdown: string } }
    | {
        kind: 'ACTIONS';
        config: { actions: { id: string; entity: string; label: string }[] };
      }
  );
