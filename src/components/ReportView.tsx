import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Cf7Settings, Cf7Submission, GroupByKey, ReportRange } from '../types/cf7sdb';
import {
  buildReportCsv,
  computeReport,
  downloadTextFile,
  getAvailableGroups,
  getFormOptions,
  resolveReportDates,
} from '../utils/cf7Logic';

interface ReportViewProps {
  submissions: Cf7Submission[];
  settings: Cf7Settings;
  onOpenSettings: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  submissions,
  settings,
  onOpenSettings,
}) => {
  const [range, setRange] = useState<ReportRange>('current');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByKey>('form_id');
  const [formId, setFormId] = useState<number>(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const availableGroups = useMemo(() => getAvailableGroups(settings), [settings]);
  const effectiveGroupBy: GroupByKey = availableGroups.some((g) => g.key === groupBy)
    ? groupBy
    : 'form_id';

  const dates = useMemo(
    () => resolveReportDates(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const formOptions = useMemo(() => getFormOptions(submissions), [submissions]);

  const report = useMemo(
    () =>
      computeReport(
        submissions,
        {
          range,
          date_from: dates.date_from,
          date_to: dates.date_to,
          group_by: effectiveGroupBy,
          form_id: formId,
        },
        settings,
      ),
    [submissions, range, dates, effectiveGroupBy, formId, settings],
  );

  const handleToggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of report.groups) {
      next[g.key] = expand;
    }
    setOpenGroups(next);
  };

  const handleExportCsv = () => {
    const csv = buildReportCsv(report, effectiveGroupBy);
    downloadTextFile(
      `report-cf7-${effectiveGroupBy}-${dates.date_from}_${dates.date_to}.csv`,
      csv,
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Report contatti</h2>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Periodo: <strong className="text-slate-700">{dates.date_from}</strong> →{' '}
            <strong className="text-slate-700">{dates.date_to}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={report.groups.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Esporta CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="block text-xs font-medium text-slate-700">
            Periodo
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as ReportRange)}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
            >
              <option value="current">Mese corrente</option>
              <option value="last">Mese scorso</option>
              <option value="custom">Date libere</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Dal (date libere)
            <input
              type="date"
              value={range === 'custom' ? dates.date_from : customFrom || dates.date_from}
              disabled={range !== 'custom'}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md disabled:bg-slate-50 disabled:text-slate-400 tabular-nums"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Al (date libere)
            <input
              type="date"
              value={range === 'custom' ? dates.date_to : customTo || dates.date_to}
              disabled={range !== 'custom'}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md disabled:bg-slate-50 disabled:text-slate-400 tabular-nums"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Raggruppa per
            <select
              value={effectiveGroupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByKey)}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
            >
              {availableGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Solo form
            <select
              value={formId}
              onChange={(e) => setFormId(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
            >
              <option value={0}>Tutti</option>
              {formOptions.map((o) => (
                <option key={o.form_id} value={o.form_id}>
                  {o.title} (#{o.form_id})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-700 tabular-nums">
          Contatti nel periodo: <strong className="text-slate-900">{report.raw}</strong>
          {' − '}
          test esclusi: <strong className="text-slate-900">{report.tests}</strong>
          {' − '}
          duplicati esclusi: <strong className="text-slate-900">{report.dups}</strong>
          {' = '}
          <strong className="text-base text-sky-800">{report.final}</strong> contatti validi.
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0"
        >
          Impostazioni filtri report
        </button>
      </div>

      {/* Expand / Collapse controls */}
      {report.groups.length > 0 && (
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => handleExpandAll(true)}
            className="font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0"
          >
            Espandi tutto
          </button>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            onClick={() => handleExpandAll(false)}
            className="font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0"
          >
            Comprimi tutto
          </button>
        </div>
      )}

      {/* Groups */}
      {report.groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
          Nessun contatto nel periodo selezionato.
        </div>
      ) : (
        <div className="space-y-3">
          {report.groups.map((g) => {
            const isOpen = !!openGroups[g.key];
            return (
              <div
                key={g.key}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleToggleGroup(g.key)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {g.label}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                    {g.total} {g.total === 1 ? 'contatto' : 'contatti'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 font-mono">
                          <th className="px-5 py-2.5">utm_source</th>
                          <th className="px-5 py-2.5">utm_medium</th>
                          <th className="px-5 py-2.5">utm_term</th>
                          <th className="px-5 py-2.5">utm_content</th>
                          <th className="px-5 py-2.5 text-right font-sans w-28">Contatti</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {g.rows.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="px-5 py-2.5 font-mono text-xs text-slate-700">
                              {r.utm_source || <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-xs text-slate-700">
                              {r.utm_medium || <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-xs text-slate-700">
                              {r.utm_term || <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-xs text-slate-700">
                              {r.utm_content || <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                              {r.c}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
