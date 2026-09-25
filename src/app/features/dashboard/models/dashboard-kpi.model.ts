export type KpiKind = 'processed' | 'jira' | 'meetings' | 'errors';

export interface DashboardKpi {
  kind: KpiKind;
  label: string;
  value: number;
  hint: string;
}
