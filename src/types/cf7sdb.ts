export type UtmKey =
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_campaign_new'
  | 'utm_term'
  | 'utm_content';

export type GroupByKey = 'form_id' | 'utm_campaign' | 'utm_campaign_new';

export interface Cf7Submission {
  id: number;
  form_id: number;
  form_title: string;
  submitted_at: string; // YYYY-MM-DD HH:mm:ss
  email: string;
  first_name: string;
  last_name: string;
  ip: string;
  user_agent: string;
  page_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_campaign_new: string;
  utm_term: string;
  utm_content: string;
  data: Record<string, string | string[]>;
}

export interface Cf7Settings {
  email_field: string;
  first_name_field: string;
  last_name_field: string;
  use_campaign_new: boolean;
  store_ip: boolean;
  test_emails: string;
  exclude_duplicates: boolean;
}

export interface ListFilters {
  date_from: string;
  date_to: string;
  form_id: number;
  email: string;
  s: string;
}

export type SortColumn = 'id' | 'submitted_at' | 'first_name' | 'last_name' | 'email';
export type SortOrder = 'asc' | 'desc';

export type ReportRange = 'current' | 'last' | 'custom';

export interface ReportFilters {
  range: ReportRange;
  date_from: string;
  date_to: string;
  group_by: GroupByKey;
  form_id: number;
}

export interface ReportDetailRow {
  utm_source: string;
  utm_medium: string;
  utm_term: string;
  utm_content: string;
  c: number;
}

export interface ReportGroup {
  key: string;
  label: string;
  total: number;
  rows: ReportDetailRow[];
}

export interface ReportData {
  groups: ReportGroup[];
  raw: number;
  tests: number;
  dups: number;
  final: number;
}

export interface ReprocessStatus {
  running: boolean;
  done: number;
  updated: number;
  lastRunAt: string | null;
}

export type AdminTab = 'contacts' | 'report' | 'settings' | 'docs';
