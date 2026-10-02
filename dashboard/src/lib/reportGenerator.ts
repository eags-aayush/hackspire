export interface ExecutiveReportData {
  title?: string;
  summary?: string;
  sections?: any[];
}

export function buildAlertsReport(): ExecutiveReportData { return {}; }
export function buildAnalyticsReport(): ExecutiveReportData { return {}; }
export function buildMlDemoReport(): ExecutiveReportData { return {}; }
export function buildMonitoringReport(): ExecutiveReportData { return {}; }
export function downloadReportHtml() {}
