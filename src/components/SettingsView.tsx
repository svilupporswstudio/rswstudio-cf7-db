import React, { useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { Cf7Settings, ReprocessStatus } from '../types/cf7sdb';
import { DEFAULT_SETTINGS, parseTestEmails, sanitizeFieldName } from '../utils/cf7Logic';

interface SettingsViewProps {
  settings: Cf7Settings;
  onSaveSettings: (next: Cf7Settings) => void;
  reprocessStatus: ReprocessStatus;
  onReprocess: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  reprocessStatus,
  onReprocess,
}) => {
  const [draft, setDraft] = useState<Cf7Settings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Cf7Settings = {
      email_field: sanitizeFieldName(draft.email_field, DEFAULT_SETTINGS.email_field),
      first_name_field: sanitizeFieldName(
        draft.first_name_field,
        DEFAULT_SETTINGS.first_name_field,
      ),
      last_name_field: sanitizeFieldName(
        draft.last_name_field,
        DEFAULT_SETTINGS.last_name_field,
      ),
      use_campaign_new: draft.use_campaign_new,
      store_ip: draft.store_ip,
      test_emails: parseTestEmails(draft.test_emails).join('\n'),
      exclude_duplicates: draft.exclude_duplicates,
    };
    setDraft(cleaned);
    onSaveSettings(cleaned);
    setSavedNotice(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">Impostazioni Contatti CF7</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configurazione corrispondente a <code className="text-slate-700">Contatti &gt; Impostazioni</code> del plugin WordPress.
        </p>
      </div>

      {savedNotice && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md">
          <span>Impostazioni salvate.</span>
          <button
            type="button"
            onClick={() => setSavedNotice(false)}
            className="text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap shrink-0"
          >
            Chiudi
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campi dei form */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Campi dei form</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Nome del campo così come l&apos;hai scritto nel form di Contact Form 7 (es.{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">
                [email* your-email]
              </code>{' '}
              → <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">your-email</code>
              ). Maiuscole e differenza tra <code className="bg-slate-100 px-1 py-0.5 rounded">-</code> e{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded">_</code> vengono ignorate. Validi per tutti i form.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block text-xs font-medium text-slate-700">
              Campo email
              <input
                type="text"
                value={draft.email_field}
                onChange={(e) => setDraft((d) => ({ ...d, email_field: e.target.value }))}
                className="mt-1.5 w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Campo nome
              <input
                type="text"
                value={draft.first_name_field}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, first_name_field: e.target.value }))
                }
                className="mt-1.5 w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Campo cognome
              <input
                type="text"
                value={draft.last_name_field}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, last_name_field: e.target.value }))
                }
                className="mt-1.5 w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
              />
            </label>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-2.5 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.use_campaign_new}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, use_campaign_new: e.target.checked }))
                }
                className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
              <span>
                I form usano anche il campo{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                  utm_campaign_new
                </code>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Se disattivato, la colonna e il raggruppamento{' '}
                  <code>utm_campaign_new</code> vengono nascosti (i dati già salvati non vengono toccati).
                </span>
              </span>
            </label>
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Privacy</h3>
          <label className="flex items-start gap-2.5 text-sm text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.store_ip}
              onChange={(e) => setDraft((d) => ({ ...d, store_ip: e.target.checked }))}
              className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <span>
              Salva indirizzo IP e user agent di chi compila il form
              <span className="block text-xs text-slate-500 mt-0.5">
                Sono dati personali ai fini GDPR: disattivali se non ti servono.
              </span>
            </span>
          </label>
        </section>

        {/* Report */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <h3 className="text-base font-semibold text-slate-900">Report</h3>
          <label className="block text-xs font-medium text-slate-700">
            Email di test
            <textarea
              rows={4}
              value={draft.test_emails}
              onChange={(e) => setDraft((d) => ({ ...d, test_emails: e.target.value }))}
              className="mt-1.5 w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600"
            />
            <span className="block text-xs font-normal text-slate-500 mt-1">
              Una per riga. I contatti con queste email sono esclusi{' '}
              <strong>solo dal report</strong>, non dalla lista né dall&apos;export contatti.
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-slate-800 cursor-pointer pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              checked={draft.exclude_duplicates}
              onChange={(e) =>
                setDraft((d) => ({ ...d, exclude_duplicates: e.target.checked }))
              }
              className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <span>
              Escludi i contatti doppi dal report
              <span className="block text-xs text-slate-500 mt-0.5">
                Doppio = stesso raggruppamento scelto nel report (form, utm_campaign o utm_campaign_new) + stesso nome + stesso cognome + stessa email, nel periodo selezionato. Viene contato il primo invio.
              </span>
            </span>
          </label>
        </section>

        <div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4" />
            Salva impostazioni
          </button>
        </div>
      </form>

      {/* Reprocess */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Rielabora contatti esistenti</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Se hai cambiato il nome dei campi email / nome / cognome, puoi riapplicarli ai contatti già salvati (rilegge i dati originali di ogni invio e aggiorna email, nome, cognome e UTM). Salva prima le impostazioni. Su WordPress l&apos;elaborazione avviene in background a lotti di 1000 contatti via WP-Cron.
        </p>

        {reprocessStatus.lastRunAt && (
          <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2 tabular-nums">
            <strong>Stato:</strong>{' '}
            {reprocessStatus.running
              ? `in corso, ${reprocessStatus.done} contatti elaborati finora…`
              : `completata (${reprocessStatus.done} contatti elaborati, ${reprocessStatus.updated} aggiornati alle ${reprocessStatus.lastRunAt}).`}
          </p>
        )}

        <button
          type="button"
          onClick={onReprocess}
          disabled={reprocessStatus.running}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reprocessStatus.running ? 'animate-spin' : ''}`} />
          Rielabora ora
        </button>
      </section>
    </div>
  );
};
