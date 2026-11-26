import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Eye,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Cf7Settings,
  Cf7Submission,
  ListFilters,
  SortColumn,
  SortOrder,
} from '../types/cf7sdb';
import {
  buildSubmissionsCsv,
  downloadTextFile,
  filterSubmissions,
  flatValue,
  getFormOptions,
  sortSubmissions,
} from '../utils/cf7Logic';

interface ContactsViewProps {
  submissions: Cf7Submission[];
  settings: Cf7Settings;
  onDelete: (ids: number[]) => void;
  onOpenSimulator: () => void;
}

const EMPTY_FILTERS: ListFilters = {
  date_from: '',
  date_to: '',
  form_id: 0,
  email: '',
  s: '',
};

const PER_PAGE = 25;

export const ContactsView: React.FC<ContactsViewProps> = ({
  submissions,
  settings,
  onDelete,
  onOpenSimulator,
}) => {
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const [orderby, setOrderby] = useState<SortColumn>('id');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<number[] | null>(null);

  const formOptions = useMemo(() => getFormOptions(submissions), [submissions]);

  const filtered = useMemo(
    () => filterSubmissions(submissions, filters),
    [submissions, filters],
  );

  const sorted = useMemo(
    () => sortSubmissions(filtered, orderby, order),
    [filtered, orderby, order],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PER_PAGE;
    return sorted.slice(start, start + PER_PAGE);
  }, [sorted, safePage]);

  const detailRow = useMemo(
    () => (detailId !== null ? submissions.find((s) => s.id === detailId) ?? null : null),
    [submissions, detailId],
  );

  const handleSort = (col: SortColumn) => {
    if (orderby === col) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderby(col);
      setOrder(col === 'id' || col === 'submitted_at' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pageItems.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleExecuteDelete = (ids: number[]) => {
    onDelete(ids);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    setConfirmDeleteIds(null);
    setNotice(`${ids.length} ${ids.length === 1 ? 'contatto eliminato' : 'contatti eliminati'}.`);
    if (detailId !== null && ids.includes(detailId)) {
      setDetailId(null);
    }
  };

  const handleExportCsv = () => {
    const csv = buildSubmissionsCsv(filtered, settings);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 15);
    downloadTextFile(`contatti-cf7-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const renderSortIcon = (col: SortColumn) => {
    if (orderby !== col) return null;
    return order === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 inline-block ml-1 text-sky-700" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 inline-block ml-1 text-sky-700" />
    );
  };

  if (detailId !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900 mb-2 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna alla lista
            </button>
            <h2 className="text-xl font-semibold text-slate-900 tabular-nums">
              Contatto #{detailId}
            </h2>
          </div>
          {detailRow && (
            <button
              type="button"
              onClick={() => setConfirmDeleteIds([detailRow.id])}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Elimina contatto
            </button>
          )}
        </div>

        {!detailRow ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-600">
            Contatto non trovato.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                <h3 className="text-sm font-semibold text-slate-900">Informazioni</h3>
              </div>
              <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Data', detailRow.submitted_at],
                    ['Form', `${detailRow.form_title} (#${detailRow.form_id})`],
                    ['Nome', detailRow.first_name || '—'],
                    ['Cognome', detailRow.last_name || '—'],
                    ['Email', detailRow.email || '—'],
                    ['IP', detailRow.ip || '—'],
                    ['User agent', detailRow.user_agent || '—'],
                    ['Pagina', detailRow.page_url || '—'],
                  ].map(([label, val]) => (
                    <tr key={label} className="hover:bg-slate-50/60">
                      <th className="w-48 px-5 py-3 font-medium text-slate-600 bg-slate-50/40 align-top">
                        {label}
                      </th>
                      <td className="px-5 py-3 text-slate-900 break-all font-mono text-xs tabular-nums">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                <h3 className="text-sm font-semibold text-slate-900">Campi compilati</h3>
              </div>
              <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(detailRow.data).map(([k, v]) => (
                    <tr key={k} className="hover:bg-slate-50/60">
                      <th className="w-48 px-5 py-3 font-mono text-xs font-medium text-slate-600 bg-slate-50/40 align-top">
                        {k}
                      </th>
                      <td className="px-5 py-3 text-slate-900 whitespace-pre-wrap break-words">
                        {flatValue(v) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {confirmDeleteIds && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">Conferma eliminazione</h3>
              <p className="text-sm text-slate-600">
                Eliminare definitivamente questo contatto dall&apos;archivio? L&apos;operazione non è reversibile.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteDelete(confirmDeleteIds)}
                  className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 whitespace-nowrap shrink-0"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Contatti Contact Form 7</h2>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'contatto trovato' : 'contatti trovati'}
            {' · '}
            {submissions.length} totali in archivio
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Esporta CSV (con filtri attivi)
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap shrink-0"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <label className="block text-xs font-medium text-slate-700">
            Dal
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, date_from: e.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600 tabular-nums"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Al
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, date_to: e.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600 tabular-nums"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Form
            <select
              value={filters.form_id}
              onChange={(e) => {
                setFilters((f) => ({ ...f, form_id: Number(e.target.value) }));
                setPage(1);
              }}
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
          <label className="block text-xs font-medium text-slate-700">
            Email
            <input
              type="text"
              value={filters.email}
              onChange={(e) => {
                setFilters((f) => ({ ...f, email: e.target.value }));
                setPage(1);
              }}
              placeholder="contiene..."
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Ricerca libera
            <div className="relative mt-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={filters.s}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, s: e.target.value }));
                  setPage(1);
                }}
                placeholder="in tutti i campi"
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
              />
            </div>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-md text-xs">
          <span className="font-medium text-slate-800 tabular-nums">
            {selectedIds.length} {selectedIds.length === 1 ? 'elemento selezionato' : 'elementi selezionati'}
          </span>
          <button
            type="button"
            onClick={() => setConfirmDeleteIds(selectedIds)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-white bg-red-600 rounded hover:bg-red-700 whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Elimina selezionati
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Seleziona tutti i contatti nella pagina"
                    checked={
                      pageItems.length > 0 &&
                      pageItems.every((item) => selectedIds.includes(item.id))
                    }
                    onChange={(e) => handleToggleAll(e.target.checked)}
                    className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                  />
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="font-semibold text-slate-700 hover:text-sky-700 inline-flex items-center whitespace-nowrap"
                  >
                    ID {renderSortIcon('id')}
                  </button>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('submitted_at')}
                    className="font-semibold text-slate-700 hover:text-sky-700 inline-flex items-center whitespace-nowrap"
                  >
                    Data {renderSortIcon('submitted_at')}
                  </button>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">Form</th>
                <th className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('first_name')}
                    className="font-semibold text-slate-700 hover:text-sky-700 inline-flex items-center whitespace-nowrap"
                  >
                    Nome {renderSortIcon('first_name')}
                  </button>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('last_name')}
                    className="font-semibold text-slate-700 hover:text-sky-700 inline-flex items-center whitespace-nowrap"
                  >
                    Cognome {renderSortIcon('last_name')}
                  </button>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('email')}
                    className="font-semibold text-slate-700 hover:text-sky-700 inline-flex items-center whitespace-nowrap"
                  >
                    Email {renderSortIcon('email')}
                  </button>
                </th>
                <th className="px-4 py-3 whitespace-nowrap font-mono">utm_campaign</th>
                {settings.use_campaign_new && (
                  <th className="px-4 py-3 whitespace-nowrap font-mono">utm_campaign_new</th>
                )}
                <th className="px-4 py-3 whitespace-nowrap">Source / Medium</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={settings.use_campaign_new ? 11 : 10}
                    className="px-6 py-12 text-center"
                  >
                    <p className="text-sm font-medium text-slate-700">Nessun contatto trovato.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Prova a modificare i filtri oppure simula una nuova compilazione di Contact Form 7.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenSimulator}
                      className="mt-4 inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-sky-700 rounded-md hover:bg-sky-800 whitespace-nowrap shrink-0"
                    >
                      Simula invio CF7
                    </button>
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const sourceMedium = [item.utm_source, item.utm_medium]
                    .filter(Boolean)
                    .join(' / ');
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Seleziona contatto #${item.id}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleToggleOne(item.id)}
                          className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetailId(item.id)}
                          className="text-sky-700 hover:underline"
                        >
                          #{item.id}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {item.submitted_at}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 max-w-[220px] truncate">
                        <span>{item.form_title}</span>{' '}
                        <span className="text-slate-400 text-xs tabular-nums">
                          (#{item.form_id})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                        {item.first_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                        {item.last_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                        {item.email || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {item.utm_campaign || '—'}
                      </td>
                      {settings.use_campaign_new && (
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {item.utm_campaign_new || '—'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {sourceMedium || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailId(item.id)}
                            title="Dettaglio"
                            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Dettaglio
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteIds([item.id])}
                            title="Elimina"
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <span className="tabular-nums">
              Pagina {safePage} di {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Precedente
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Successiva
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDeleteIds && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Conferma eliminazione</h3>
            <p className="text-sm text-slate-600">
              {confirmDeleteIds.length === 1
                ? 'Eliminare questo contatto?'
                : `Eliminare i ${confirmDeleteIds.length} contatti selezionati?`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDelete(confirmDeleteIds)}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 whitespace-nowrap shrink-0"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
