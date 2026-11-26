# CF7 Submissions DB

Plugin WordPress leggero e senza dipendenze esterne per salvare su database tutte le compilazioni dei moduli **Contact Form 7**, completo di elenco amministrativo filtrabile, vista dettaglio, esportazione CSV compatibile con Excel, report aggregato per form e campagne UTM (con esclusione automatica di email di test e duplicati) e rielaborazione batch dei contatti storici.

- **Versione plugin**: `1.3.0`
- **File principale**: `rsw-cf7-submissions-db.php`
- **Text Domain**: `cf7-submissions-db`
- **Requisiti minimi**: WordPress, plugin **Contact Form 7** attivo, **PHP >= 7.4** (con estensioni `mbstring` e `json`), MySQL / MariaDB.

---

## Indice

1. [Funzionalità principali](#1-funzionalità-principali)
2. [Installazione](#2-installazione)
3. [Configurazione iniziale (Impostazioni)](#3-configurazione-iniziale-impostazioni)
4. [Gestione Contatti e Dettaglio](#4-gestione-contatti-e-dettaglio)
5. [Esportazione CSV](#5-esportazione-csv)
6. [Report aggregato e logica di deduplica](#6-report-aggregato-e-logica-di-deduplica)
7. [Tracciamento UTM con Contact Form 7](#7-tracciamento-utm-con-contact-form-7)
8. [Rielaborazione dei contatti esistenti](#8-rielaborazione-dei-contatti-esistenti)
9. [Permessi, ruoli e personalizzazione per sviluppatori](#9-permessi-ruoli-e-personalizzazione-per-sviluppatori)
10. [Struttura del database e opzioni WordPress](#10-struttura-del-database-e-opzioni-wordpress)
11. [Risoluzione dei problemi (FAQ)](#11-risoluzione-dei-problemi-faq)

---

## 1. Funzionalità principali

- **Cattura sicura e non bloccante**: utilizza l'hook `wpcf7_before_send_mail` (priorità `5`) avvolto in un blocco `try/catch (\Throwable)`. Qualunque errore imprevisto sul database viene registrato nel log PHP senza **mai** impedire l'invio del form o della mail all'utente.
- **Esclusione automatica dello spam**: i messaggi contrassegnati con stato `spam` da Contact Form 7 vengono ignorati prima del salvataggio.
- **Estrazione intelligente di Email, Nome, Cognome e UTM**: normalizza i nomi dei campi (ignorando maiuscole/minuscole e differenze tra `-` e `_`) e salva in colonne indicizzate `email`, `first_name`, `last_name` e 6 parametri UTM (`utm_source`, `utm_medium`, `utm_campaign`, `utm_campaign_new`, `utm_term`, `utm_content`), oltre al payload completo in JSON (`data`).
- **Privacy / GDPR configurabile**: consente di attivare o disattivare il salvataggio di indirizzo IP e User Agent.
- **Export CSV per Excel in italiano**: genera file UTF-8 con BOM (`\xEF\xBB\xBF`), separatore `;`, colonne dinamiche per tutti i campi compilati e protezione integrata contro *CSV/Formula Injection*.
- **Report aggregato pronto per l'analisi**: raggruppa i contatti per `Form`, `utm_campaign` o `utm_campaign_new`, escludendo automaticamente eventuali email di test e invii duplicati nel periodo selezionato.

---

## 2. Installazione

### Metodo A — Da bacheca WordPress (consigliato)

1. Scarica o comprimi in un file `.zip` la cartella contenente `rsw-cf7-submissions-db.php` (es. `rswstudio-cf7-db.zip`).
2. Accedi alla bacheca di WordPress e vai su **Plugin > Aggiungi plugin**.
3. Clicca su **Carica plugin** in alto, seleziona il file `.zip` e premi **Installa ora**.
4. Al termine dell'installazione, clicca su **Attiva plugin**.

### Metodo B — Caricamento manuale via FTP / SFTP

1. Collegati al server via FTP/SFTP e apri la directory `/wp-content/plugins/`.
2. Crea la cartella `rswstudio-cf7-db`.
3. Carica al suo interno il file `rsw-cf7-submissions-db.php` (e opzionalmente questo `README.md`).
4. Nella bacheca WordPress vai su **Plugin > Plugin installati**, individua **CF7 Submissions DB** e clicca su **Attiva**.

### Metodo C — Da terminale con Git e WP-CLI

```bash
cd /percorso/di/wordpress/wp-content/plugins/
git clone https://github.com/svilupporswstudio/rswstudio-cf7-db.git
wp plugin activate rswstudio-cf7-db
```

### Cosa avviene all'attivazione

All'attivazione del plugin viene eseguita la funzione `CF7SDB::install()`:
- Crea (o aggiorna tramite `dbDelta`) la tabella `{prefix}cf7sdb_submissions` con i relativi indici (`submitted_at`, `form_id`, `email`, `utm_campaign`, `utm_campaign_new`).
- Registra l'opzione `cf7sdb_db_version` con valore `1.3.0`.
- In caso di aggiornamento da una versione precedente alla `1.1.0`, pianifica automaticamente in background una rielaborazione (`WP-Cron`) per popolare `first_name` e `last_name` sui contatti già presenti in archivio.

> **Nota**: assicurati che il plugin **Contact Form 7** sia installato e attivo. Il plugin cattura esclusivamente i moduli gestiti da `WPCF7_Submission`.

---

## 3. Configurazione iniziale (Impostazioni)

Dopo l'attivazione comparirà nel menu laterale di WordPress la voce **Contatti** con tre sottomenu: **Contatti**, **Report** e **Impostazioni**.

Vai su **Contatti > Impostazioni** (accessibile agli utenti con permesso `manage_options`, tipicamente gli **Amministratori**) per configurare il plugin:

### Campi dei form

Specifica i nomi dei tag così come li hai scritti nei moduli di Contact Form 7 (ad esempio, se nel form hai `[email* your-email]`, inserisci `your-email`):

| Opzione | Default | Descrizione |
|---|---|---|
| **Campo email** | `email` | Nome del campo usato per estrarre l'indirizzo email principale. |
| **Campo nome** | `nome` | Nome del campo usato per estrarre il nome (`first_name`). |
| **Campo cognome** | `cognome` | Nome del campo usato per estrarre il cognome (`last_name`). |
| **utm_campaign_new** | Attivo (`1`) | Se attivo, mostra la colonna `utm_campaign_new` nella lista contatti, nell'export CSV e tra le opzioni di raggruppamento del Report. Se disattivato, la nasconde senza cancellare i dati già salvati. |

**Regole di estrazione e fallback automatici:**
- Il confronto dei nomi dei campi **ignora maiuscole/minuscole** e tratta `-` e `_` come equivalenti (es. `your-email`, `Your_Email` e `your_email` corrispondono).
- Solo caratteri `[A-Za-z0-9_-]` sono ammessi nei nomi campo configurati.
- **Fallback Email**: se il campo configurato è vuoto o assente nel form, il plugin cerca il primo valore valido di tipo email (`is_email()`) tra i dati inviati e, in ulteriore subordine, il valore del primo tag CF7 di tipo `email` definito nel modulo.

### Privacy (GDPR)

- **Salva indirizzo IP e user agent di chi compila il form** (`store_ip`, attivo di default): registra l'IP remoto (`remote_ip`) e l'`HTTP_USER_AGENT` del browser. Disattiva questa opzione se la tua informativa privacy o le policy GDPR richiedono di non memorizzare questi dati tecnici.

### Report

- **Email di test** (`test_emails`, default `test@rswstudio.it`): inserisci **un indirizzo email per riga** (sono accettati anche spazi, virgole o punto e virgola come separatori). I contatti inviati con queste email vengono **esclusi esclusivamente dai conteggi del Report**, mentre rimangono visibili e scaricabili nella lista **Contatti** e nell'export CSV.
- **Duplicati** (`exclude_duplicates`, attivo di default): se attivo, esclude gli invii duplicati dai conteggi del Report secondo i criteri descritti nella [Sezione 6](#6-report-aggregato-e-logica-di-deduplica).

---

## 4. Gestione Contatti e Dettaglio

Dalla pagina **Contatti > Contatti** puoi consultare tutte le compilazioni salvate (`25` record per pagina):

- **Filtri disponibili**:
  - **Dal / Al**: intervallo date (`YYYY-MM-DD`) basato su `submitted_at`.
  - **Form**: filtro per singolo modulo Contact Form 7 (elenco popolato dai moduli presenti in archivio, con cache transient di 12 ore invalidata automaticamente all'arrivo di un nuovo form o alla cancellazione).
  - **Email**: ricerca parziale sull'indirizzo email.
  - **Ricerca libera**: cerca contemporaneamente in `email`, `first_name`, `last_name`, `form_title` e nell'intero JSON `data` (utile per cercare numeri di telefono, messaggi, campi personalizzati o valori UTM).
- **Ordinamento**: clicca sulle intestazioni di colonna **ID**, **Data**, **Nome**, **Cognome** o **Email** per ordinare in senso crescente o decrescente.
- **Dettaglio contatto**: clicca sull'ID (es. `#42`) o su **Dettaglio** per visualizzare:
  1. **Informazioni**: Data, Form (titolo e ID), Nome, Cognome, Email, IP, User agent, Pagina di provenienza (`page_url`).
  2. **Campi compilati**: tabella completa di tutti i campi presenti nel payload JSON dell'invio, inclusi campi dinamici e **nomi dei file caricati** (il plugin salva solo il `basename` dei file allegati, senza appesantire il database con file binari).
- **Eliminazione**: gli Amministratori (`manage_options`) possono eliminare un singolo contatto dal link **Elimina** nella riga oppure selezionare più contatti tramite checkbox e usare l'azione di gruppo **Elimina**.

---

## 5. Esportazione CSV

Dalla pagina **Contatti**, il pulsante **Esporta CSV (con filtri attivi)** scarica esattamente i record corrispondenti ai filtri impostati in quel momento.

### Caratteristiche tecniche dell'export

- **Colonne fisse**: `ID`, `Data`, `Form ID`, `Form`, `Nome`, `Cognome`, `Email`, `IP`, `Pagina`.
- **Colonne UTM**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_campaign_new` (se abilitata), `utm_term`, `utm_content`. Il plugin legge il valore completo dal JSON originale (superando il limite di 190 caratteri delle colonne indicizzate su DB).
- **Colonne dinamiche**: in una prima passata a lotti da `500` righe, il plugin raccoglie automaticamente tutte le chiavi extra presenti nei form filtrati (es. `telefono`, `messaggio`, `azienda`, `privacy`) evitando duplicati con i campi già rappresentati nelle colonne fisse.
- **Compatibilità Excel italiano**: codifica UTF-8 con BOM e separatore `;`.
- **Sicurezza anti-CSV Injection**: eventuali valori che iniziano con `=`, `+`, `-`, `@`, tab o `\r` vengono preceduti da un apice `'`, **ad eccezione** dei numeri di telefono o numeri negativi validi (es. `+39 333 1234567`, `-5`), che restano intatti e utilizzabili.

---

## 6. Report aggregato e logica di deduplica

La schermata **Contatti > Report** offre una vista sintetica delle conversioni per valutare l'andamento dei moduli e delle campagne marketing.

### Filtri del Report

- **Periodo**:
  - `Mese corrente`: dal primo all'ultimo giorno del mese attuale.
  - `Mese scorso`: dal primo all'ultimo giorno del mese precedente.
  - `Date libere`: intervallo personalizzato tramite i campi **Dal** e **Al**.
- **Raggruppa per**:
  - `Form` (`form_id`)
  - `utm_campaign`
  - `utm_campaign_new` (visibile solo se abilitato nelle impostazioni)
- **Solo form**: restringe il report a un singolo modulo CF7 mantenendo comunque il raggruppamento scelto.

### Come vengono calcolati i totali

Il riepilogo in cima al report mostra sempre la scomposizione trasparente dei numeri:

```text
Contatti nel periodo − test esclusi − duplicati esclusi = contatti validi
```

1. **Conteggio grezzo**: tutti gli invii presenti nel periodo (e nell'eventuale form selezionato).
2. **Esclusione test**: rimozione degli invii la cui `email` (case-insensitive) compare nell'elenco *Email di test*.
3. **Esclusione duplicati** *(se attiva in Impostazioni)*: viene considerato duplicato ogni invio che, all'interno del periodo selezionato, condivide la stessa tupla:
   `(valore del raggruppamento scelto + first_name + last_name + email)`
   Viene mantenuto e conteggiato esclusivamente il **primo invio** (`MIN(id)`).
   > **Nota**: i contatti in cui `email`, `first_name` e `last_name` sono tutti e tre vuoti non possono essere deduplicati e vengono mantenuti singolarmente.

Ogni gruppo è espandibile (sono disponibili i pulsanti **Espandi tutto / Comprimi tutto**) e mostra la ripartizione dettagliata per `utm_source`, `utm_medium`, `utm_term` e `utm_content`. Il pulsante **Esporta CSV** in alto scarica il riepilogo aggregato mantenendo i filtri e l'ordine mostrati a schermo.

---

## 7. Tracciamento UTM con Contact Form 7

Il plugin legge i parametri UTM direttamente dai dati inviati dal modulo Contact Form 7. Affinché vengano memorizzati nelle colonne dedicate, aggiungi i corrispondenti campi nascosti nel template del form su **Contatto > Moduli di contatto**:

```text
[hidden utm_source default:get]
[hidden utm_medium default:get]
[hidden utm_campaign default:get]
[hidden utm_campaign_new default:get]
[hidden utm_term default:get]
[hidden utm_content default:get]
```

Se utilizzi uno script personalizzato lato client (cookie / `sessionStorage` / GTM) per popolare i parametri UTM tra una pagina e l'altra, assicurati che gli attributi `name` degli `<input type="hidden">` corrispondano esattamente a `utm_source`, `utm_medium`, `utm_campaign`, `utm_campaign_new`, `utm_term` e `utm_content` (eventuali trattini come `utm-source` vengono comunque normalizzati automaticamente in `utm_source`).

---

## 8. Rielaborazione dei contatti esistenti

Se dopo aver raccolto dei contatti cambi i nomi dei campi nelle **Impostazioni** (ad esempio passi da `email` a `your-email`, oppure da `nome` a `your-name`), i record già salvati conserverebbero i vecchi valori nelle colonne indicizzate.

Per aggiornare lo storico:
1. Modifica i nomi dei campi in **Contatti > Impostazioni** e clicca su **Salva impostazioni**.
2. Nella sezione inferiore **Rielabora contatti esistenti**, clicca su **Rielabora ora**.
3. Il plugin rilegge il JSON originale (`data`) di ogni invio in background tramite **WP-Cron** (`cf7sdb_reprocess_batch`) a lotti di **1000 contatti** alla volta e aggiorna `email`, `first_name`, `last_name` e i 6 campi UTM (preservando l'eventuale `email` precedente se la nuova estrazione dovesse risultare vuota).
4. Ricaricando la pagina delle Impostazioni puoi verificare lo stato dell'operazione (`in corso, X contatti elaborati finora…` oppure `completata`).

---

## 9. Permessi, ruoli e personalizzazione per sviluppatori

### Capability predefinite

| Schermata / Azione | Capability default | Ruoli WordPress standard |
|---|---|---|
| Visualizzare ed esportare **Contatti** e **Report** | `edit_others_posts` | **Amministratori** ed **Editori** |
| Modificare **Impostazioni**, avviare **Rielabora ora**, **Eliminare** contatti | `manage_options` | Solo **Amministratori** |

Gli utenti che hanno accesso solo in lettura (`edit_others_posts` senza `manage_options`) non vedono le checkbox di selezione multipla né il link **Elimina** nella tabella.

### Modificare il permesso di consultazione (`cf7sdb_view_capability`)

Puoi personalizzare chi può accedere a **Contatti** e **Report** aggiungendo il filtro `cf7sdb_view_capability` nel file `functions.php` del tema child o in un mu-plugin:

```php
// Esempio: consenti anche agli Autori (capability 'edit_posts') di consultare Contatti e Report
add_filter( 'cf7sdb_view_capability', function () {
    return 'edit_posts';
} );
```

---

## 10. Struttura del database e opzioni WordPress

### Tabella `{wp_prefix}cf7sdb_submissions`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | `bigint(20) unsigned` | Chiave primaria auto-increment |
| `form_id` | `bigint(20) unsigned` | ID del modulo CF7 (`KEY`) |
| `form_title` | `varchar(255)` | Titolo del modulo al momento dell'invio |
| `submitted_at` | `datetime` | Data/ora locale WordPress (`current_time('mysql')`, `KEY`) |
| `email` | `varchar(190)` | Email estratta (`KEY`) |
| `first_name` | `varchar(190)` | Nome estratto |
| `last_name` | `varchar(190)` | Cognome estratto |
| `ip` | `varchar(64)` | Indirizzo IP (vuoto se `store_ip` disattivato) |
| `user_agent` | `varchar(255)` | User agent (vuoto se `store_ip` disattivato) |
| `page_url` | `text` | URL della pagina di invio |
| `utm_source` | `varchar(190)` | Parametro `utm_source` |
| `utm_medium` | `varchar(190)` | Parametro `utm_medium` |
| `utm_campaign` | `varchar(190)` | Parametro `utm_campaign` (`KEY`) |
| `utm_campaign_new` | `varchar(190)` | Parametro `utm_campaign_new` (`KEY`) |
| `utm_term` | `varchar(190)` | Parametro `utm_term` |
| `utm_content` | `varchar(190)` | Parametro `utm_content` |
| `data` | `longtext` | JSON completo di tutti i campi inviati |

### Opzioni e transient utilizzati

- `cf7sdb_settings`: array associativo con le impostazioni del plugin.
- `cf7sdb_db_version`: versione corrente dello schema DB (`1.3.0`).
- `cf7sdb_reprocess`: stato dell'ultimo/corrente job di rielaborazione (`last`, `done`, `running`).
- `cf7sdb_forms` (transient, durata 12 ore): cache dell'elenco form distinti usati nei filtri.
- `cf7sdb_upgrading` (transient, durata 60 secondi): lock anti-concorrenza durante l'upgrade.

---

## 11. Risoluzione dei problemi (FAQ)

**Le colonne Nome, Cognome o Email risultano vuote (`—`) nella tabella Contatti.**
Verifica il nome esatto dei tag nel modulo Contact Form 7 (es. `your-name` invece di `nome`), aggiornalo in **Contatti > Impostazioni**, salva e poi premi **Rielabora ora** per aggiornare anche i contatti già salvati.

**Ho cliccato su "Rielabora ora" ma il conteggio resta a 0 o non avanza.**
La rielaborazione usa **WP-Cron** (`wp_schedule_single_event`). Su siti con poco traffico o con `DISABLE_WP_CRON` impostato su `true` in `wp-config.php`, assicurati che sia attivo un cron di sistema verso `wp-cron.php` oppure esegui da terminale `wp cron event run cf7sdb_reprocess_batch`.

**Un invio di prova non compare nel Report ma c'è nella lista Contatti.**
È il comportamento atteso se l'indirizzo usato rientra tra le **Email di test** configurate nelle impostazioni (di default `test@rswstudio.it`) oppure se è un **duplicato** nel periodo selezionato.

**I campi interni di CF7 (es. `_wpcf7_unit_tag`) vengono salvati?**
No. Tutti i campi che iniziano con `_` vengono scartati automaticamente durante la cattura.
