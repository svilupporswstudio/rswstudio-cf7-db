import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import { Cf7Settings } from '../types/cf7sdb';

interface SimulateModalProps {
  settings: Cf7Settings;
  onClose: () => void;
  onSubmitPayload: (payload: {
    form_id: number;
    form_title: string;
    page_url: string;
    is_spam: boolean;
    data: Record<string, string>;
  }) => void;
}

export const SimulateModal: React.FC<SimulateModalProps> = ({
  settings,
  onClose,
  onSubmitPayload,
}) => {
  const [formId, setFormId] = useState(142);
  const [formTitle, setFormTitle] = useState('Richiesta Preventivo Sito Web');
  const [pageUrl, setPageUrl] = useState('https://www.esempio.it/contatti/');
  const [firstName, setFirstName] = useState('Sara');
  const [lastName, setLastName] = useState('Galli');
  const [email, setEmail] = useState('sara.galli@azienda.it');
  const [phone, setPhone] = useState('+39 349 1122334');
  const [message, setMessage] = useState('Richiesta informazioni per nuovo sito aziendale.');
  const [utmSource, setUtmSource] = useState('google');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('lead_siti_b2b');
  const [utmCampaignNew, setUtmCampaignNew] = useState('2026_q4_siti_web');
  const [utmTerm, setUtmTerm] = useState('sviluppo wordpress');
  const [utmContent, setUtmContent] = useState('annuncio_b');
  const [isSpam, setIsSpam] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitPayload({
      form_id: formId,
      form_title: formTitle,
      page_url: pageUrl,
      is_spam: isSpam,
      data: {
        [settings.first_name_field]: firstName,
        [settings.last_name_field]: lastName,
        [settings.email_field]: email,
        telefono: phone,
        messaggio: message,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_campaign_new: utmCampaignNew,
        utm_term: utmTerm,
        utm_content: utmContent,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Simula invio Contact Form 7
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Esegue la stessa logica di cattura di{' '}
              <code className="text-slate-700">CF7SDB::capture()</code> usando i campi configurati.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi finestra"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-slate-700">
              Form ID
              <input
                type="number"
                value={formId}
                onChange={(e) => setFormId(Number(e.target.value) || 1)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
              Titolo Form
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-slate-700">
              {settings.first_name_field}
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              {settings.last_name_field}
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              {settings.email_field}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-700">
              telefono
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Pagina di invio
              <input
                type="url"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            messaggio
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700 font-mono">
              utm_source
              <input
                type="text"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700 font-mono">
              utm_medium
              <input
                type="text"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700 font-mono">
              utm_campaign
              <input
                type="text"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700 font-mono">
              utm_campaign_new
              <input
                type="text"
                value={utmCampaignNew}
                onChange={(e) => setUtmCampaignNew(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700 font-mono">
              utm_term
              <input
                type="text"
                value={utmTerm}
                onChange={(e) => setUtmTerm(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700 font-mono">
              utm_content
              <input
                type="text"
                value={utmContent}
                onChange={(e) => setUtmContent(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
            <input
              type="checkbox"
              checked={isSpam}
              onChange={(e) => setIsSpam(e.target.checked)}
              className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            Simula stato <code className="bg-slate-100 px-1 py-0.5 rounded">spam</code> (deve essere scartato prima del salvataggio)
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Invia compilazione
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
