/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Database,
  Plus,
  RotateCcw,
  Settings,
  Users,
} from 'lucide-react';
import { ContactsView } from './components/ContactsView';
import { DocumentationView } from './components/DocumentationView';
import { ReportView } from './components/ReportView';
import { SettingsView } from './components/SettingsView';
import { SimulateModal } from './components/SimulateModal';
import {
  AdminTab,
  Cf7Settings,
  Cf7Submission,
  ReprocessStatus,
} from './types/cf7sdb';
import {
  createInitialDemoSubmissions,
  DEFAULT_SETTINGS,
  extractFields,
} from './utils/cf7Logic';

const STORAGE_SUBMISSIONS = 'cf7sdb_submissions_v1';
const STORAGE_SETTINGS = 'cf7sdb_settings_v1';

function loadInitialSubmissions(): Cf7Submission[] {
  try {
    const raw = localStorage.getItem(STORAGE_SUBMISSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fallback to initial sample submissions
  }
  return createInitialDemoSubmissions();
}

function loadInitialSettings(): Cf7Settings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback to default settings
  }
  return DEFAULT_SETTINGS;
}

const TAB_TITLES: Record<AdminTab, string> = {
  contacts: 'Contatti',
  report: 'Report',
  settings: 'Impostazioni',
  docs: 'Guida & README',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AdminTab>('docs');
  const [submissions, setSubmissions] = useState<Cf7Submission[]>(loadInitialSubmissions);
  const [settings, setSettings] = useState<Cf7Settings>(loadInitialSettings);
  const [showSimulator, setShowSimulator] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reprocessStatus, setReprocessStatus] = useState<ReprocessStatus>({
    running: false,
    done: 0,
    updated: 0,
    lastRunAt: null,
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SUBMISSIONS, JSON.stringify(submissions));
    } catch {
      // Ignore storage quota errors
    }
  }, [submissions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const handleDeleteSubmissions = (ids: number[]) => {
    const idSet = new Set(ids);
    setSubmissions((prev) => prev.filter((item) => !idSet.has(item.id)));
  };

  const handleSaveSettings = (next: Cf7Settings) => {
    setSettings(next);
  };

  const handleReprocess = () => {
    setReprocessStatus({ running: true, done: 0, updated: 0, lastRunAt: null });

    let updatedCount = 0;
    const reprocessed = submissions.map((row) => {
      const extracted = extractFields(row.data, settings);
      if (!extracted.email) {
        extracted.email = row.email;
      }
      const changed =
        extracted.email !== row.email ||
        extracted.first_name !== row.first_name ||
        extracted.last_name !== row.last_name ||
        extracted.utm_source !== row.utm_source ||
        extracted.utm_medium !== row.utm_medium ||
        extracted.utm_campaign !== row.utm_campaign ||
        extracted.utm_campaign_new !== row.utm_campaign_new ||
        extracted.utm_term !== row.utm_term ||
        extracted.utm_content !== row.utm_content;

      if (changed) {
        updatedCount += 1;
      }
      return { ...row, ...extracted };
    });

    setSubmissions(reprocessed);
    const nowTime = new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setReprocessStatus({
      running: false,
      done: reprocessed.length,
      updated: updatedCount,
      lastRunAt: nowTime,
    });
  };

  const handleSimulateSubmit = (payload: {
    form_id: number;
    form_title: string;
    page_url: string;
    is_spam: boolean;
    data: Record<string, string>;
  }) => {
    setShowSimulator(false);
    if (payload.is_spam) {
      showNotice('Invio marcato come spam da Contact Form 7: ignorato prima del salvataggio.');
      return;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const submittedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const nextId = submissions.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const extracted = extractFields(payload.data, settings);

    const newRow: Cf7Submission = {
      id: nextId,
      form_id: payload.form_id,
      form_title: payload.form_title,
      submitted_at: submittedAt,
      ...extracted,
      ip: settings.store_ip ? '192.0.2.45' : '',
      user_agent: settings.store_ip ? navigator.userAgent.slice(0, 255) : '',
      page_url: payload.page_url,
      data: payload.data,
    };

    setSubmissions((prev) => [newRow, ...prev]);
    setActiveTab('contacts');
    showNotice(`Compilazione #${nextId} salvata in archivio.`);
  };

  const handleResetDemo = () => {
    setSubmissions(createInitialDemoSubmissions());
    setSettings(DEFAULT_SETTINGS);
    setReprocessStatus({ running: false, done: 0, updated: 0, lastRunAt: null });
    showNotice('Dati dimostrativi e impostazioni predefinite ripristinati.');
  };

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: typeof Users;
    count?: number;
  }> = [
    { id: 'docs', label: 'Guida & README', icon: BookOpen },
    { id: 'contacts', label: 'Contatti', icon: Users, count: submissions.length },
    { id: 'report', label: 'Report', icon: BarChart3 },
    { id: 'settings', label: 'Impostazioni', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-100 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2.5">
          <Database className="w-5 h-5 text-sky-400 shrink-0" />
          <span className="text-sm font-bold tracking-tight whitespace-nowrap">
            CF7 Submissions DB
          </span>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-sky-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`text-xs tabular-nums ${
                      active ? 'text-sky-100' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-auto p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          <p className="leading-relaxed">
            Repository sincronizzato:{' '}
            <span className="text-slate-200 font-mono">rswstudio-cf7-db</span>
          </p>
          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Ripristina dati demo
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
            <span className="font-medium text-slate-700 whitespace-nowrap">
              RSW Studio
            </span>
            <span aria-hidden="true">/</span>
            <span className="whitespace-nowrap">CF7 Submissions DB</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900 truncate">
              {TAB_TITLES[activeTab]}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowSimulator(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Simula invio CF7
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1400px] w-full">
          {toast && (
            <div className="mb-5 px-4 py-3 text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-md flex items-center justify-between gap-4">
              <span>{toast}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-xs font-medium text-sky-800 hover:underline whitespace-nowrap shrink-0"
              >
                Chiudi
              </button>
            </div>
          )}

          {activeTab === 'docs' && <DocumentationView />}
          {activeTab === 'contacts' && (
            <ContactsView
              submissions={submissions}
              settings={settings}
              onDelete={handleDeleteSubmissions}
              onOpenSimulator={() => setShowSimulator(true)}
            />
          )}
          {activeTab === 'report' && (
            <ReportView
              submissions={submissions}
              settings={settings}
              onOpenSettings={() => setActiveTab('settings')}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              reprocessStatus={reprocessStatus}
              onReprocess={handleReprocess}
            />
          )}
        </main>
      </div>

      {showSimulator && (
        <SimulateModal
          settings={settings}
          onClose={() => setShowSimulator(false)}
          onSubmitPayload={handleSimulateSubmit}
        />
      )}
    </div>
  );
}
