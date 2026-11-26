import React, { useState } from 'react';
import { Check, Copy, Download, FileCode2, FileText } from 'lucide-react';
import readmeRaw from '../../README.md?raw';
import pluginPhpRaw from '../../rsw-cf7-submissions-db.php?raw';
import { downloadTextFile } from '../utils/cf7Logic';

interface SnippetBlockProps {
  title: string;
  code: string;
}

const SnippetBlock: React.FC<SnippetBlockProps> = ({ title, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiato' : 'Copia'}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed bg-white">
        {code}
      </pre>
    </div>
  );
};

export const DocumentationView: React.FC = () => {
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);

  const utmSnippet = `[hidden utm_source default:get]
[hidden utm_medium default:get]
[hidden utm_campaign default:get]
[hidden utm_campaign_new default:get]
[hidden utm_term default:get]
[hidden utm_content default:get]`;

  const wpCliSnippet = `cd /percorso/di/wordpress/wp-content/plugins/
git clone https://github.com/svilupporswstudio/rswstudio-cf7-db.git
wp plugin activate rswstudio-cf7-db`;

  const capabilitySnippet = `// Nel functions.php del tema child o in un mu-plugin:
// Consenti anche agli Autori (edit_posts) di vedere Contatti e Report
add_filter( 'cf7sdb_view_capability', function () {
    return 'edit_posts';
} );`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Guida all&apos;installazione e all&apos;utilizzo (README.md)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            CF7 Submissions DB v1.3.0 · Plugin WordPress per Contact Form 7 · PHP &gt;= 7.4
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadTextFile('README.md', readmeRaw, 'text/markdown;charset=utf-8')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Scarica README.md
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                'rsw-cf7-submissions-db.php',
                pluginPhpRaw,
                'application/x-php;charset=utf-8',
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Scarica plugin PHP
          </button>
        </div>
      </div>

      {/* Quick setup & usage summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            01. Installazione rapida su WordPress
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 leading-relaxed">
            <li>
              Verifica che <strong>Contact Form 7</strong> sia installato e attivo (PHP &gt;= 7.4).
            </li>
            <li>
              Carica la cartella <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">rswstudio-cf7-db</code> in{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/wp-content/plugins/</code> oppure installa lo ZIP da{' '}
              <strong>Plugin &gt; Aggiungi plugin &gt; Carica plugin</strong>.
            </li>
            <li>
              Attiva <strong>CF7 Submissions DB</strong>: viene creata automaticamente la tabella{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{prefix}'}cf7sdb_submissions</code>.
            </li>
          </ol>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            02. Configurazione consigliata
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 leading-relaxed">
            <li>
              Apri <strong>Contatti &gt; Impostazioni</strong> e allinea i nomi dei campi{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">email</code>,{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">nome</code>,{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">cognome</code> ai tag CF7 reali (es.{' '}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">your-email</code>).
            </li>
            <li>
              Inserisci le email interne in <strong>Email di test</strong> per escluderle dal Report.
            </li>
            <li>
              Valuta la disattivazione di <strong>IP e user agent</strong> se richiesto dalla tua policy GDPR.
            </li>
          </ol>
        </section>
      </div>

      {/* Snippets */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Snippet pronti all&apos;uso</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SnippetBlock title="Campi nascosti UTM in Contact Form 7" code={utmSnippet} />
          <SnippetBlock title="Installazione via Git + WP-CLI" code={wpCliSnippet} />
        </div>
        <SnippetBlock
          title="Filtro permessi visualizzazione (cf7sdb_view_capability)"
          code={capabilitySnippet}
        />
      </div>

      {/* Full README.md source toggle */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileCode2 className="w-4 h-4 text-slate-600" />
            Contenuto completo di README.md
          </div>
          <button
            type="button"
            onClick={() => setShowRawMarkdown((v) => !v)}
            className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0"
          >
            {showRawMarkdown ? 'Comprimi anteprima' : 'Mostra tutto README.md'}
          </button>
        </div>
        <pre
          className={`p-5 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed overflow-x-auto ${
            showRawMarkdown ? '' : 'max-h-96 overflow-y-auto'
          }`}
        >
          {readmeRaw}
        </pre>
      </section>
    </div>
  );
};
