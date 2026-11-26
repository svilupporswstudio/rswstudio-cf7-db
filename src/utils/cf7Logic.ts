import {
  Cf7Settings,
  Cf7Submission,
  GroupByKey,
  ListFilters,
  ReportData,
  ReportDetailRow,
  ReportFilters,
  ReportGroup,
  ReportRange,
  SortColumn,
  SortOrder,
  UtmKey,
} from '../types/cf7sdb';

export const UTM_ALL: UtmKey[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_campaign_new',
  'utm_term',
  'utm_content',
];

export const DEFAULT_SETTINGS: Cf7Settings = {
  email_field: 'email',
  first_name_field: 'nome',
  last_name_field: 'cognome',
  use_campaign_new: true,
  store_ip: true,
  test_emails: 'test@rswstudio.it',
  exclude_duplicates: true,
};

export function normKey(key: string): string {
  return String(key).toLowerCase().replace(/-/g, '_');
}

export function flatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(flatValue).join(', ');
  }
  return String(value ?? '').replace(/\0/g, '');
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function extractFields(
  data: Record<string, unknown>,
  settings: Cf7Settings,
): {
  email: string;
  first_name: string;
  last_name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_campaign_new: string;
  utm_term: string;
  utm_content: string;
} {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    normalized[normKey(k)] = flatValue(v).trim();
  }

  const pick = (field: string): string => {
    const k = normKey(field);
    return normalized[k] ?? '';
  };

  let email = pick(settings.email_field);
  const first_name = pick(settings.first_name_field).slice(0, 190);
  const last_name = pick(settings.last_name_field).slice(0, 190);

  if (!email) {
    for (const val of Object.values(normalized)) {
      if (isEmailLike(val)) {
        email = val;
        break;
      }
    }
  }

  return {
    email: email.slice(0, 190),
    first_name,
    last_name,
    utm_source: (normalized.utm_source ?? '').slice(0, 190),
    utm_medium: (normalized.utm_medium ?? '').slice(0, 190),
    utm_campaign: (normalized.utm_campaign ?? '').slice(0, 190),
    utm_campaign_new: (normalized.utm_campaign_new ?? '').slice(0, 190),
    utm_term: (normalized.utm_term ?? '').slice(0, 190),
    utm_content: (normalized.utm_content ?? '').slice(0, 190),
  };
}

export function sanitizeFieldName(value: string, fallback: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '');
  return cleaned || fallback;
}

export function parseTestEmails(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && isEmailLike(s));
  return Array.from(new Set(parts));
}

export function getActiveUtmFields(settings: Cf7Settings): UtmKey[] {
  return settings.use_campaign_new
    ? UTM_ALL
    : UTM_ALL.filter((u) => u !== 'utm_campaign_new');
}

export function getAvailableGroups(settings: Cf7Settings): Array<{ key: GroupByKey; label: string }> {
  const groups: Array<{ key: GroupByKey; label: string }> = [
    { key: 'form_id', label: 'Form' },
    { key: 'utm_campaign', label: 'utm_campaign' },
  ];
  if (settings.use_campaign_new) {
    groups.push({ key: 'utm_campaign_new', label: 'utm_campaign_new' });
  }
  return groups;
}

export function getFormOptions(rows: Cf7Submission[]): Array<{ form_id: number; title: string }> {
  const map = new Map<number, string>();
  for (const row of rows) {
    const prev = map.get(row.form_id) ?? '';
    if (row.form_title >= prev) {
      map.set(row.form_id, row.form_title);
    }
  }
  return Array.from(map.entries())
    .map(([form_id, title]) => ({ form_id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'it'));
}

export function filterSubmissions(
  rows: Cf7Submission[],
  filters: ListFilters,
  excludeEmails: string[] = [],
): Cf7Submission[] {
  const excludedSet = new Set(excludeEmails.map((e) => e.toLowerCase()));
  const emailQuery = filters.email.trim().toLowerCase();
  const freeQuery = filters.s.trim().toLowerCase();

  return rows.filter((row) => {
    const datePart = row.submitted_at.slice(0, 10);
    if (filters.date_from && datePart < filters.date_from) return false;
    if (filters.date_to && datePart > filters.date_to) return false;
    if (filters.form_id && row.form_id !== filters.form_id) return false;
    if (emailQuery && !row.email.toLowerCase().includes(emailQuery)) return false;
    if (excludedSet.size > 0 && excludedSet.has(row.email.toLowerCase())) return false;
    if (freeQuery) {
      const jsonStr = JSON.stringify(row.data).toLowerCase();
      const haystack = [
        row.email,
        row.first_name,
        row.last_name,
        row.form_title,
        jsonStr,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(freeQuery)) return false;
    }
    return true;
  });
}

export function sortSubmissions(
  rows: Cf7Submission[],
  orderby: SortColumn,
  order: SortOrder,
): Cf7Submission[] {
  const factor = order === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (orderby === 'id') {
      return (a.id - b.id) * factor;
    }
    return String(a[orderby]).localeCompare(String(b[orderby]), 'it') * factor;
  });
}

export function resolveReportDates(
  range: ReportRange,
  customFrom: string,
  customTo: string,
  now = new Date(),
): { date_from: string; date_to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (range === 'last') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { date_from: fmt(first), date_to: fmt(last) };
  }

  if (range === 'custom') {
    const firstThisMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    return {
      date_from: /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : firstThisMonth,
      date_to: /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : fmt(now),
    };
  }

  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { date_from: fmt(first), date_to: fmt(last) };
}

export function computeReport(
  rows: Cf7Submission[],
  filters: ReportFilters,
  settings: Cf7Settings,
): ReportData {
  const baseFilter: ListFilters = {
    date_from: filters.date_from,
    date_to: filters.date_to,
    form_id: filters.form_id,
    email: '',
    s: '',
  };

  const periodRows = filterSubmissions(rows, baseFilter);
  const raw = periodRows.length;

  const testEmails = parseTestEmails(settings.test_emails);
  const cleanRows = filterSubmissions(rows, baseFilter, testEmails);
  const clean = cleanRows.length;

  const col = filters.group_by;

  let dedupedRows = cleanRows;
  if (settings.exclude_duplicates) {
    // Keep earliest submission (smallest id) per (group_by + first_name + last_name + email)
    const sortedById = [...cleanRows].sort((a, b) => a.id - b.id);
    const seen = new Set<string>();
    dedupedRows = [];
    for (const r of sortedById) {
      const groupVal = col === 'form_id' ? String(r.form_id) : r[col];
      const identityKey =
        r.email === '' && r.first_name === '' && r.last_name === ''
          ? `#${r.id}`
          : `${r.first_name.toLowerCase()}|${r.last_name.toLowerCase()}|${r.email.toLowerCase()}`;
      const composite = `${groupVal}::${identityKey}`;
      if (!seen.has(composite)) {
        seen.add(composite);
        dedupedRows.push(r);
      }
    }
  }

  const groupMap = new Map<
    string,
    { label: string; total: number; detailMap: Map<string, ReportDetailRow> }
  >();

  for (const r of dedupedRows) {
    const gKey = col === 'form_id' ? String(r.form_id) : r[col];
    const label =
      col === 'form_id'
        ? `${r.form_title || 'Form'} (#${r.form_id})`
        : gKey !== ''
          ? gKey
          : '(non valorizzato)';

    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, { label, total: 0, detailMap: new Map() });
    }
    const gEntry = groupMap.get(gKey)!;
    gEntry.total += 1;

    const detailKey = [r.utm_source, r.utm_medium, r.utm_term, r.utm_content].join('||');
    if (!gEntry.detailMap.has(detailKey)) {
      gEntry.detailMap.set(detailKey, {
        utm_source: r.utm_source,
        utm_medium: r.utm_medium,
        utm_term: r.utm_term,
        utm_content: r.utm_content,
        c: 0,
      });
    }
    gEntry.detailMap.get(detailKey)!.c += 1;
  }

  const groups: ReportGroup[] = Array.from(groupMap.entries())
    .map(([key, val]) => ({
      key,
      label: val.label,
      total: val.total,
      rows: Array.from(val.detailMap.values()).sort((a, b) => b.c - a.c),
    }))
    .sort((a, b) => b.total - a.total);

  const final = dedupedRows.length;
  return {
    groups,
    raw,
    tests: raw - clean,
    dups: clean - final,
    final,
  };
}

/**
 * Exact port of CF7SDB::csv_cell() — prevents Excel formula injection
 * while keeping phone numbers (+39 333 1234567) and negative numbers (-5) untouched.
 */
export function csvCell(value: unknown): string {
  const str = flatValue(value);
  if (
    str !== '' &&
    ['=', '+', '-', '@', '\t', '\r'].includes(str[0]) &&
    !/^[+\-]?[\d\s().\-]+$/.test(str)
  ) {
    return `'${str}`;
  }
  return str;
}

function encodeCsvRow(cells: unknown[]): string {
  return cells
    .map((cell) => {
      const safe = csvCell(cell);
      const escaped = safe.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(';');
}

export function buildSubmissionsCsv(
  rows: Cf7Submission[],
  settings: Cf7Settings,
): string {
  const skip = new Set<string>([
    ...UTM_ALL,
    normKey(settings.email_field),
    normKey(settings.first_name_field),
    normKey(settings.last_name_field),
  ]);

  const dynamicKeySet = new Set<string>();
  const orderedAsc = [...rows].sort((a, b) => a.id - b.id);
  for (const r of orderedAsc) {
    for (const k of Object.keys(r.data)) {
      if (!skip.has(normKey(k))) {
        dynamicKeySet.add(k);
      }
    }
  }
  const dynamicKeys = Array.from(dynamicKeySet);
  const utmFields = getActiveUtmFields(settings);

  const header = [
    'ID',
    'Data',
    'Form ID',
    'Form',
    'Nome',
    'Cognome',
    'Email',
    'IP',
    'Pagina',
    ...utmFields,
    ...dynamicKeys,
  ];

  const lines = [encodeCsvRow(header)];

  for (const r of orderedAsc) {
    const normalizedData: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.data)) {
      normalizedData[normKey(k)] = flatValue(v);
    }

    const rowCells: unknown[] = [
      r.id,
      r.submitted_at,
      r.form_id,
      r.form_title,
      r.first_name,
      r.last_name,
      r.email,
      r.ip,
      r.page_url,
    ];

    for (const u of utmFields) {
      rowCells.push(normalizedData[u] && normalizedData[u] !== '' ? normalizedData[u] : r[u]);
    }
    for (const k of dynamicKeys) {
      rowCells.push(r.data[k] ?? '');
    }
    lines.push(encodeCsvRow(rowCells));
  }

  return '\uFEFF' + lines.join('\r\n');
}

export function buildReportCsv(
  report: ReportData,
  groupBy: GroupByKey,
): string {
  const groupHeader =
    groupBy === 'form_id'
      ? 'Form'
      : groupBy === 'utm_campaign'
        ? 'utm_campaign'
        : 'utm_campaign_new';

  const header = [
    groupHeader,
    'Totale gruppo',
    'utm_source',
    'utm_medium',
    'utm_term',
    'utm_content',
    'Contatti',
  ];

  const lines = [encodeCsvRow(header)];
  for (const g of report.groups) {
    for (const r of g.rows) {
      lines.push(
        encodeCsvRow([
          g.label,
          g.total,
          r.utm_source,
          r.utm_medium,
          r.utm_term,
          r.utm_content,
          r.c,
        ]),
      );
    }
  }

  return '\uFEFF' + lines.join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function createInitialDemoSubmissions(now = new Date()): Cf7Submission[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymCurr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const ymPrev = `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}`;

  const rawSamples: Array<{
    id: number;
    form_id: number;
    form_title: string;
    submitted_at: string;
    ip: string;
    user_agent: string;
    page_url: string;
    data: Record<string, string | string[]>;
  }> = [
    {
      id: 1,
      form_id: 142,
      form_title: 'Richiesta Preventivo Sito Web',
      submitted_at: `${ymPrev}-12 09:42:18`,
      ip: '185.120.44.19',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      page_url: 'https://www.esempio.it/realizzazione-siti-web/',
      data: {
        nome: 'Marco',
        cognome: 'Bellini',
        email: 'marco.bellini@officinabellini.it',
        telefono: '+39 347 8129400',
        azienda: 'Officina Bellini Srl',
        budget: '5.000€ - 10.000€',
        messaggio: 'Vorremmo rinnovare il portale B2B entro il prossimo trimestre.',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'lead_siti_b2b',
        utm_campaign_new: '2026_q4_siti_web',
        utm_term: 'agenzia web b2b',
        utm_content: 'annuncio_a',
      },
    },
    {
      id: 2,
      form_id: 142,
      form_title: 'Richiesta Preventivo Sito Web',
      submitted_at: `${ymPrev}-21 15:11:04`,
      ip: '93.41.102.88',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      page_url: 'https://www.esempio.it/realizzazione-siti-web/',
      data: {
        nome: 'Giulia',
        cognome: 'Ferri',
        email: 'g.ferri@studioferri.it',
        telefono: '+39 339 5510291',
        azienda: 'Studio Ferri Associati',
        messaggio: 'Richiesta call conoscitiva per restyling sito istituzionale.',
        utm_source: 'linkedin',
        utm_medium: 'paid_social',
        utm_campaign: 'brand_awareness',
        utm_campaign_new: '2026_q4_siti_web',
        utm_term: 'direttori_marketing',
        utm_content: 'carousel_case_study',
      },
    },
    {
      id: 3,
      form_id: 142,
      form_title: 'Richiesta Preventivo Sito Web',
      submitted_at: `${ymCurr}-03 10:15:32`,
      ip: '151.34.89.12',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      page_url: 'https://www.esempio.it/contatti/',
      data: {
        nome: 'Test',
        cognome: 'RSW',
        email: 'test@rswstudio.it',
        telefono: '+39 02 1234567',
        messaggio: 'Invio di verifica campi nascosti UTM dopo deploy.',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'lead_siti_b2b',
        utm_campaign_new: '2026_q4_siti_web',
        utm_term: 'test',
        utm_content: 'qa',
      },
    },
    {
      id: 4,
      form_id: 205,
      form_title: 'Consulenza SEO & Google Ads',
      submitted_at: `${ymCurr}-06 11:28:45`,
      ip: '82.58.14.201',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
      page_url: 'https://www.esempio.it/campagne-google-ads/',
      data: {
        nome: 'Elena',
        cognome: 'Conti',
        email: 'elena.conti@arredoconti.it',
        telefono: '+39 340 9928172',
        settore: 'Arredamento & Design',
        allegato_brief: 'brief-campagna-2026.pdf',
        messaggio: 'Cerchiamo supporto per ottimizzare le campagne Search.',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'ads_performance',
        utm_campaign_new: '2026_q4_google_ads',
        utm_term: 'consulenza google ads',
        utm_content: 'rsa_search_01',
      },
    },
    {
      id: 5,
      form_id: 205,
      form_title: 'Consulenza SEO & Google Ads',
      submitted_at: `${ymCurr}-06 11:31:09`,
      ip: '82.58.14.201',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
      page_url: 'https://www.esempio.it/campagne-google-ads/',
      data: {
        nome: 'Elena',
        cognome: 'Conti',
        email: 'elena.conti@arredoconti.it',
        telefono: '+39 340 9928172',
        settore: 'Arredamento & Design',
        messaggio: 'Secondo invio accidentale dopo ricaricamento pagina.',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'ads_performance',
        utm_campaign_new: '2026_q4_google_ads',
        utm_term: 'consulenza google ads',
        utm_content: 'rsa_search_01',
      },
    },
    {
      id: 6,
      form_id: 142,
      form_title: 'Richiesta Preventivo Sito Web',
      submitted_at: `${ymCurr}-11 16:04:50`,
      ip: '79.18.210.44',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      page_url: 'https://www.esempio.it/ecommerce-wordpress/',
      data: {
        nome: 'Davide',
        cognome: 'Moretti',
        email: 'd.moretti@cantinamoretti.it',
        telefono: '+39 335 7741209',
        azienda: 'Cantina Moretti',
        servizi: ['E-commerce WooCommerce', 'Integrazione ERP'],
        messaggio: 'Vorremmo vendere online 120 referenze con listini B2B.',
        utm_source: 'meta',
        utm_medium: 'cpc',
        utm_campaign: 'ecommerce_italia',
        utm_campaign_new: '2026_q4_ecommerce',
        utm_term: 'lookalike_buyers',
        utm_content: 'video_reel_02',
      },
    },
    {
      id: 7,
      form_id: 288,
      form_title: 'Download Whitepaper Marketing',
      submitted_at: `${ymCurr}-14 08:53:12`,
      ip: '5.90.112.77',
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64)',
      page_url: 'https://www.esempio.it/risorse/guida-lead-generation/',
      data: {
        nome: 'Chiara',
        cognome: 'Lombardi',
        email: 'chiara@lombardiconsulting.com',
        ruolo: 'Marketing Manager',
        consenso_newsletter: 'Sì',
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'dem_novembre',
        utm_campaign_new: '2026_q4_nurturing',
        utm_term: '',
        utm_content: 'cta_header',
      },
    },
    {
      id: 8,
      form_id: 205,
      form_title: 'Consulenza SEO & Google Ads',
      submitted_at: `${ymCurr}-18 14:22:03`,
      ip: '37.162.88.14',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      page_url: 'https://www.esempio.it/audit-seo/',
      data: {
        nome: 'Lorenzo',
        cognome: 'Riva',
        email: 'lorenzo.riva@meccanicariva.it',
        telefono: '+39 348 3309184',
        sito_attuale: 'https://www.meccanicariva.it',
        messaggio: 'Calato il traffico organico dopo migrazione dominio.',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: '',
        utm_campaign_new: '',
        utm_term: '',
        utm_content: '',
      },
    },
  ];

  return rawSamples.map((sample) => {
    const extracted = extractFields(sample.data, DEFAULT_SETTINGS);
    return {
      ...sample,
      ...extracted,
    };
  });
}
