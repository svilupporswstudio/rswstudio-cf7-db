<?php
/**
 * Plugin Name: CF7 Submissions DB
 * Description: Salva su database tutte le compilazioni di Contact Form 7, con lista admin (filtri + export CSV), impostazioni e report aggregato per form / utm_campaign / utm_campaign_new.
 * Version: 1.3.0
 * Author: —
 * Text Domain: cf7-submissions-db
 * Requires PHP: 7.4
 */

defined( 'ABSPATH' ) || exit;

if ( is_admin() ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

final class CF7SDB {

	const DB_VERSION = '1.3.0';
	const CAP        = 'manage_options'; // impostazioni, eliminazione, rielaborazione
	const VIEW_CAP   = 'edit_others_posts'; // default per Contatti e Report: Editori e Amministratori
	const OPT        = 'cf7sdb_settings';

	/** Campi UTM salvati anche in colonne dedicate (per filtri e aggregazioni veloci). */
	const UTM = array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_campaign_new', 'utm_term', 'utm_content' );

	/** Raggruppamenti consentiti nel report. */
	const GROUPS = array(
		'form_id'          => 'Form',
		'utm_campaign'     => 'utm_campaign',
		'utm_campaign_new' => 'utm_campaign_new',
	);

	/** Impostazioni di default. */
	const DEFAULTS = array(
		'email_field'        => 'email',
		'first_name_field'   => 'nome',
		'last_name_field'    => 'cognome',
		'use_campaign_new'   => 1,
		'test_emails'        => 'test@rswstudio.it',
		'exclude_duplicates' => 1,
		'store_ip'           => 1,
	);

	/** Capacità per vedere/esportare Contatti e Report. Filtrabile: add_filter( 'cf7sdb_view_capability', fn() => 'edit_posts' ); */
	public static function view_cap() {
		$cap = apply_filters( 'cf7sdb_view_capability', self::VIEW_CAP );
		return is_string( $cap ) && '' !== $cap ? $cap : self::VIEW_CAP;
	}

	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'cf7sdb_submissions';
	}

	/* ------------------------------------------------------------------
	 * Impostazioni
	 * ---------------------------------------------------------------- */

	public static function opt( $key ) {
		static $o = null;
		if ( null === $o ) {
			$o = wp_parse_args( (array) get_option( self::OPT, array() ), self::DEFAULTS );
		}
		return $o[ $key ];
	}

	/** Elenco email di test (minuscole). */
	public static function test_emails() {
		$list = preg_split( '/[\s,;]+/', (string) self::opt( 'test_emails' ), -1, PREG_SPLIT_NO_EMPTY );
		return array_values( array_unique( array_map( 'strtolower', $list ) ) );
	}

	/** Campi UTM effettivamente in uso (esclude utm_campaign_new se disattivato). */
	public static function utm_fields() {
		return self::opt( 'use_campaign_new' )
			? self::UTM
			: array_values( array_diff( self::UTM, array( 'utm_campaign_new' ) ) );
	}

	public static function groups() {
		$g = self::GROUPS;
		if ( ! self::opt( 'use_campaign_new' ) ) {
			unset( $g['utm_campaign_new'] );
		}
		return $g;
	}

	public static function sanitize_settings( $in ) {
		$in  = (array) $in;
		$d   = self::DEFAULTS;
		$out = array();

		foreach ( array( 'email_field', 'first_name_field', 'last_name_field' ) as $k ) {
			$v       = preg_replace( '/[^A-Za-z0-9_\-]/', '', (string) ( $in[ $k ] ?? '' ) );
			$out[ $k ] = '' !== $v ? $v : $d[ $k ];
		}
		$out['use_campaign_new']   = empty( $in['use_campaign_new'] ) ? 0 : 1;
		$out['exclude_duplicates'] = empty( $in['exclude_duplicates'] ) ? 0 : 1;
		$out['store_ip']           = empty( $in['store_ip'] ) ? 0 : 1;

		$clean = array();
		foreach ( preg_split( '/[\s,;]+/', (string) ( $in['test_emails'] ?? '' ), -1, PREG_SPLIT_NO_EMPTY ) as $e ) {
			$e = strtolower( sanitize_email( $e ) );
			if ( $e ) {
				$clean[ $e ] = 1;
			}
		}
		$out['test_emails'] = implode( "\n", array_keys( $clean ) );
		return $out;
	}

	/* ------------------------------------------------------------------
	 * Bootstrap
	 * ---------------------------------------------------------------- */

	public static function init() {
		register_activation_hook( __FILE__, array( __CLASS__, 'install' ) );
		add_action( 'plugins_loaded', array( __CLASS__, 'maybe_upgrade' ) );
		add_action( 'wpcf7_before_send_mail', array( __CLASS__, 'capture' ), 5, 1 );
		add_action( 'cf7sdb_reprocess_batch', array( __CLASS__, 'reprocess_batch' ) );

		if ( is_admin() ) {
			add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
			add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
			add_action( 'admin_post_cf7sdb_export', array( __CLASS__, 'export_list' ) );
			add_action( 'admin_post_cf7sdb_export_report', array( __CLASS__, 'export_report' ) );
			add_action( 'admin_post_cf7sdb_reprocess', array( __CLASS__, 'handle_reprocess' ) );
		}
	}

	public static function register_settings() {
		register_setting( 'cf7sdb_settings_group', self::OPT, array( 'sanitize_callback' => array( __CLASS__, 'sanitize_settings' ) ) );
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$table   = self::table();

		dbDelta(
			"CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			form_id bigint(20) unsigned NOT NULL DEFAULT 0,
			form_title varchar(255) NOT NULL DEFAULT '',
			submitted_at datetime NOT NULL,
			email varchar(190) NOT NULL DEFAULT '',
			first_name varchar(190) NOT NULL DEFAULT '',
			last_name varchar(190) NOT NULL DEFAULT '',
			ip varchar(64) NOT NULL DEFAULT '',
			user_agent varchar(255) NOT NULL DEFAULT '',
			page_url text NULL,
			utm_source varchar(190) NOT NULL DEFAULT '',
			utm_medium varchar(190) NOT NULL DEFAULT '',
			utm_campaign varchar(190) NOT NULL DEFAULT '',
			utm_campaign_new varchar(190) NOT NULL DEFAULT '',
			utm_term varchar(190) NOT NULL DEFAULT '',
			utm_content varchar(190) NOT NULL DEFAULT '',
			data longtext NOT NULL,
			PRIMARY KEY  (id),
			KEY submitted_at (submitted_at),
			KEY form_id (form_id),
			KEY email (email),
			KEY utm_campaign (utm_campaign),
			KEY utm_campaign_new (utm_campaign_new)
		) $charset;"
		);
		update_option( 'cf7sdb_db_version', self::DB_VERSION );
	}

	public static function maybe_upgrade() {
		$v = get_option( 'cf7sdb_db_version' );
		if ( self::DB_VERSION === $v || get_transient( 'cf7sdb_upgrading' ) ) {
			return;
		}
		set_transient( 'cf7sdb_upgrading', 1, 60 ); // evita esecuzioni concorrenti
		self::install();
		// Da versioni precedenti alla 1.1.0: popola nome/cognome dei contatti già salvati, in background.
		if ( $v && version_compare( $v, '1.1.0', '<' ) ) {
			self::start_reprocess();
		}
		delete_transient( 'cf7sdb_upgrading' );
	}

	/* ------------------------------------------------------------------
	 * Estrazione dei campi "noti" (email, nome, cognome, UTM) dal JSON
	 * ---------------------------------------------------------------- */

	private static function norm_key( $k ) {
		return str_replace( '-', '_', strtolower( (string) $k ) );
	}

	private static function flat( $v ) {
		if ( is_array( $v ) ) {
			$v = implode( ', ', array_map( array( __CLASS__, 'flat' ), $v ) );
		}
		// Nessuna sanitizzazione "distruttiva": il dato resta quello inviato (l'output è sempre escapato).
		return str_replace( "\0", '', (string) $v );
	}

	/** Restituisce email, first_name, last_name e i 6 campi UTM a partire dall'array dei dati. */
	private static function extract_fields( $data ) {
		$n = array();
		foreach ( (array) $data as $k => $v ) {
			$n[ self::norm_key( $k ) ] = trim( is_array( $v ) ? implode( ', ', $v ) : (string) $v );
		}
		$pick = function ( $field ) use ( $n ) {
			$k = self::norm_key( $field );
			return isset( $n[ $k ] ) ? $n[ $k ] : '';
		};

		$out = array(
			'email'      => $pick( self::opt( 'email_field' ) ),
			'first_name' => $pick( self::opt( 'first_name_field' ) ),
			'last_name'  => $pick( self::opt( 'last_name_field' ) ),
		);

		// Fallback email: primo valore che sembra un indirizzo email.
		if ( '' === $out['email'] ) {
			foreach ( $n as $v ) {
				if ( is_email( $v ) ) {
					$out['email'] = $v;
					break;
				}
			}
		}
		foreach ( array( 'email', 'first_name', 'last_name' ) as $k ) {
			$out[ $k ] = mb_substr( $out[ $k ], 0, 190 );
		}
		foreach ( self::UTM as $u ) {
			$out[ $u ] = mb_substr( isset( $n[ $u ] ) ? $n[ $u ] : '', 0, 190 );
		}
		return $out;
	}

	/** Avvia la rielaborazione in background (a lotti, via WP-Cron). */
	public static function start_reprocess() {
		update_option( 'cf7sdb_reprocess', array( 'last' => 0, 'done' => 0, 'running' => 1 ), false );
		wp_clear_scheduled_hook( 'cf7sdb_reprocess_batch' );
		wp_schedule_single_event( time() + 2, 'cf7sdb_reprocess_batch' );
	}

	/** Elabora un lotto di 1000 contatti con le impostazioni correnti, poi ripianifica se serve. */
	public static function reprocess_batch() {
		global $wpdb;
		$st = get_option( 'cf7sdb_reprocess' );
		if ( ! is_array( $st ) || empty( $st['running'] ) ) {
			return;
		}
		$t     = self::table();
		$limit = 1000;
		$cols  = array_merge( array( 'email', 'first_name', 'last_name' ), self::UTM );
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT id, data, " . implode( ', ', $cols ) . " FROM $t WHERE id > %d ORDER BY id ASC LIMIT %d", (int) $st['last'], $limit ), ARRAY_A ); // phpcs:ignore

		foreach ( $rows as $r ) {
			$st['last'] = (int) $r['id'];
			$x          = self::extract_fields( json_decode( $r['data'], true ) );
			if ( '' === $x['email'] ) {
				$x['email'] = $r['email'];
			}
			$changed = array();
			foreach ( $cols as $c ) {
				if ( (string) $x[ $c ] !== (string) $r[ $c ] ) {
					$changed[ $c ] = $x[ $c ];
				}
			}
			if ( $changed ) {
				$wpdb->update( $t, $changed, array( 'id' => $st['last'] ) );
			}
			$st['done']++;
		}

		if ( count( $rows ) === $limit ) {
			update_option( 'cf7sdb_reprocess', $st, false );
			wp_schedule_single_event( time() + 2, 'cf7sdb_reprocess_batch' );
		} else {
			$st['running'] = 0;
			update_option( 'cf7sdb_reprocess', $st, false );
		}
	}

	public static function handle_reprocess() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( 'Permessi insufficienti.' );
		}
		check_admin_referer( 'cf7sdb_reprocess' );
		self::start_reprocess();
		wp_safe_redirect( admin_url( 'admin.php?page=cf7sdb-settings&reprocess=started' ) );
		exit;
	}

	/* ------------------------------------------------------------------
	 * Cattura dei dati da Contact Form 7
	 * ---------------------------------------------------------------- */

	/** Non deve mai impedire l'invio del form né l'invio della mail, qualunque cosa accada. */
	public static function capture( $form ) {
		try {
			self::do_capture( $form );
		} catch ( \Throwable $e ) {
			error_log( 'CF7 Submissions DB: ' . $e->getMessage() ); // phpcs:ignore
		}
	}

	private static function do_capture( $form ) {
		global $wpdb;

		if ( ! class_exists( 'WPCF7_Submission' ) ) {
			return;
		}
		$sub = WPCF7_Submission::get_instance();
		if ( ! $sub ) {
			return;
		}
		if ( method_exists( $sub, 'get_status' ) && 'spam' === $sub->get_status() ) {
			return;
		}

		$data = array();
		foreach ( (array) $sub->get_posted_data() as $key => $value ) {
			if ( 0 === strpos( (string) $key, '_' ) ) {
				continue; // campi interni CF7 (_wpcf7...)
			}
			$data[ $key ] = is_array( $value )
				? array_values( array_map( array( __CLASS__, 'flat' ), $value ) )
				: self::flat( $value );
		}

		// File caricati: salviamo solo i nomi file.
		if ( method_exists( $sub, 'uploaded_files' ) ) {
			foreach ( (array) $sub->uploaded_files() as $name => $paths ) {
				$names = array_map( 'basename', (array) $paths );
				if ( $names ) {
					$data[ $name ] = count( $names ) > 1 ? $names : $names[0];
				}
			}
		}

		$x = self::extract_fields( $data );

		// Ulteriore fallback email: primo campo di tipo email del form.
		if ( '' === $x['email'] ) {
			foreach ( (array) $form->scan_form_tags( array( 'basetype' => 'email' ) ) as $tag ) {
				if ( ! empty( $tag->name ) && ! empty( $data[ $tag->name ] ) ) {
					$v          = $data[ $tag->name ];
					$x['email'] = mb_substr( is_array( $v ) ? (string) reset( $v ) : $v, 0, 190 );
					break;
				}
			}
		}

		$store_ip = (bool) self::opt( 'store_ip' );
		$ua       = ( $store_ip && isset( $_SERVER['HTTP_USER_AGENT'] ) ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '';

		$ok = $wpdb->insert(
			self::table(),
			array_merge(
				array(
					'form_id'      => (int) $form->id(),
					'form_title'   => mb_substr( (string) $form->title(), 0, 255 ),
					'submitted_at' => current_time( 'mysql' ),
					'ip'           => $store_ip ? (string) $sub->get_meta( 'remote_ip' ) : '',
					'user_agent'   => $ua,
					'page_url'     => (string) $sub->get_meta( 'url' ),
				),
				$x,
				array( 'data' => self::encode( $data ) )
			)
		);

		if ( false === $ok ) {
			error_log( 'CF7 Submissions DB: insert fallita - ' . $wpdb->last_error ); // phpcs:ignore
			return;
		}

		// Se compare un form nuovo (o rinominato) invalido la cache dell'elenco form.
		$forms = get_transient( 'cf7sdb_forms' );
		if ( is_array( $forms ) ) {
			$known = false;
			foreach ( $forms as $o ) {
				if ( (int) $o->form_id === (int) $form->id() && $o->title === (string) $form->title() ) {
					$known = true;
					break;
				}
			}
			if ( ! $known ) {
				delete_transient( 'cf7sdb_forms' );
			}
		}
	}

	private static function encode( $data ) {
		$json = wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR );
		return false === $json ? '{}' : $json;
	}

	/* ------------------------------------------------------------------
	 * Query helpers condivisi (lista, export, report)
	 * ---------------------------------------------------------------- */

	private static function valid_date( $d ) {
		$d = is_string( $d ) ? trim( $d ) : '';
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d ) ? $d : '';
	}

	/** Filtri della lista contatti, letti da $_GET. */
	public static function list_filters() {
		return array(
			'date_from' => self::valid_date( wp_unslash( $_GET['date_from'] ?? '' ) ),
			'date_to'   => self::valid_date( wp_unslash( $_GET['date_to'] ?? '' ) ),
			'form_id'   => absint( $_GET['form_id'] ?? 0 ),
			'email'     => sanitize_text_field( wp_unslash( $_GET['email'] ?? '' ) ),
			's'         => sanitize_text_field( wp_unslash( $_GET['s'] ?? '' ) ),
		);
	}

	/** Restituisce [ stringa WHERE, parametri ]. */
	public static function where( $f ) {
		global $wpdb;
		$w = array( '1=1' );
		$p = array();

		if ( ! empty( $f['date_from'] ) ) {
			$w[] = 'submitted_at >= %s';
			$p[] = $f['date_from'] . ' 00:00:00';
		}
		if ( ! empty( $f['date_to'] ) ) {
			$w[] = 'submitted_at <= %s';
			$p[] = $f['date_to'] . ' 23:59:59';
		}
		if ( ! empty( $f['form_id'] ) ) {
			$w[] = 'form_id = %d';
			$p[] = (int) $f['form_id'];
		}
		if ( ! empty( $f['email'] ) ) {
			$w[] = 'email LIKE %s';
			$p[] = '%' . $wpdb->esc_like( $f['email'] ) . '%';
		}
		if ( ! empty( $f['s'] ) ) {
			$like = '%' . $wpdb->esc_like( $f['s'] ) . '%';
			$w[]  = '(email LIKE %s OR first_name LIKE %s OR last_name LIKE %s OR form_title LIKE %s OR data LIKE %s)';
			array_push( $p, $like, $like, $like, $like, $like );
		}
		if ( ! empty( $f['exclude_emails'] ) ) {
			$w[] = 'LOWER(email) NOT IN (' . implode( ',', array_fill( 0, count( $f['exclude_emails'] ), '%s' ) ) . ')';
			$p   = array_merge( $p, array_values( $f['exclude_emails'] ) );
		}
		return array( implode( ' AND ', $w ), $p );
	}

	private static function prep( $sql, $params ) {
		global $wpdb;
		return $params ? $wpdb->prepare( $sql, $params ) : $sql; // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/** Elenco form presenti nei contatti (in cache: evita una scansione della tabella a ogni pagina admin). */
	public static function forms_options() {
		global $wpdb;
		$forms = get_transient( 'cf7sdb_forms' );
		if ( ! is_array( $forms ) ) {
			$t     = self::table();
			$forms = $wpdb->get_results( "SELECT form_id, MAX(form_title) AS title FROM $t GROUP BY form_id ORDER BY title ASC" ); // phpcs:ignore
			set_transient( 'cf7sdb_forms', $forms, 12 * HOUR_IN_SECONDS );
		}
		return $forms;
	}

	private static function csv_cell( $v ) {
		if ( is_array( $v ) ) {
			$v = implode( ', ', $v );
		}
		$v = (string) $v;
		// Protezione da CSV/formula injection in Excel.
		// Numeri e telefoni (es. "+39 333 1234567", "-5") contengono solo cifre/spazi/()-. e non sono formule: restano intatti.
		if ( '' !== $v && in_array( $v[0], array( '=', '+', '-', '@', "\t", "\r" ), true ) && ! preg_match( '/^[+\-]?[\d\s().\-]+$/', $v ) ) {
			$v = "'" . $v;
		}
		return $v;
	}

	private static function csv_start( $filename ) {
		while ( ob_get_level() ) {
			ob_end_clean();
		}
		@set_time_limit( 0 ); // phpcs:ignore
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		$out = fopen( 'php://output', 'w' );
		fwrite( $out, "\xEF\xBB\xBF" ); // BOM UTF-8 per Excel
		return $out;
	}

	private static function csv_row( $out, $row ) {
		// Separatore ";" = default di Excel in italiano.
		fputcsv( $out, array_map( array( __CLASS__, 'csv_cell' ), $row ), ';', '"', '\\' );
	}

	/* ------------------------------------------------------------------
	 * Menu admin
	 * ---------------------------------------------------------------- */

	public static function menu() {
		$view = self::view_cap();
		$hook = add_menu_page( 'Contatti', 'Contatti', $view, 'cf7sdb', array( __CLASS__, 'page_list' ), 'dashicons-feedback', 30 );
		add_submenu_page( 'cf7sdb', 'Contatti', 'Contatti', $view, 'cf7sdb', array( __CLASS__, 'page_list' ) );
		add_submenu_page( 'cf7sdb', 'Report', 'Report', $view, 'cf7sdb-report', array( __CLASS__, 'page_report' ) );
		add_submenu_page( 'cf7sdb', 'Impostazioni', 'Impostazioni', self::CAP, 'cf7sdb-settings', array( __CLASS__, 'page_settings' ) );
		add_action( "load-$hook", array( __CLASS__, 'handle_delete' ) );
	}

	/* ------------------------------------------------------------------
	 * Pagina impostazioni
	 * ---------------------------------------------------------------- */

	public static function page_settings() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( 'Permessi insufficienti.' );
		}
		echo '<div class="wrap"><h1>Impostazioni Contatti CF7</h1>';
		settings_errors();
		if ( isset( $_GET['reprocess'] ) ) {
			echo '<div class="notice notice-success is-dismissible"><p>Rielaborazione avviata in background.</p></div>';
		}

		echo '<form method="post" action="' . esc_url( admin_url( 'options.php' ) ) . '">';
		settings_fields( 'cf7sdb_settings_group' );

		echo '<h2>Campi dei form</h2>';
		echo '<p class="description">Nome del campo così come l\'hai scritto nel form di Contact Form 7 (es. <code>[email* your-email]</code> → <code>your-email</code>). Maiuscole e differenza tra <code>-</code> e <code>_</code> vengono ignorate. Validi per tutti i form.</p>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::field_text( 'email_field', 'Campo email' );
		self::field_text( 'first_name_field', 'Campo nome' );
		self::field_text( 'last_name_field', 'Campo cognome' );
		echo '<tr><th scope="row">utm_campaign_new</th><td><label><input type="checkbox" name="' . esc_attr( self::OPT ) . '[use_campaign_new]" value="1"' . checked( 1, (int) self::opt( 'use_campaign_new' ), false ) . '> I form usano anche il campo <code>utm_campaign_new</code></label>';
		echo '<p class="description">Se disattivato, la colonna e il raggruppamento <code>utm_campaign_new</code> vengono nascosti (i dati già salvati non vengono toccati).</p></td></tr>';
		echo '</tbody></table>';

		echo '<h2>Privacy</h2><table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">IP e user agent</th><td><label><input type="checkbox" name="' . esc_attr( self::OPT ) . '[store_ip]" value="1"' . checked( 1, (int) self::opt( 'store_ip' ), false ) . '> Salva indirizzo IP e user agent di chi compila il form</label>';
		echo '<p class="description">Sono dati personali ai fini GDPR: disattivali se non ti servono.</p></td></tr></tbody></table>';

		echo '<h2>Report</h2><table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="cf7sdb-test">Email di test</label></th><td>';
		echo '<textarea id="cf7sdb-test" name="' . esc_attr( self::OPT ) . '[test_emails]" rows="4" class="large-text code">' . esc_textarea( (string) self::opt( 'test_emails' ) ) . '</textarea>';
		echo '<p class="description">Una per riga. I contatti con queste email sono esclusi <strong>solo dal report</strong>, non dalla lista né dall\'export contatti.</p></td></tr>';
		echo '<tr><th scope="row">Duplicati</th><td><label><input type="checkbox" name="' . esc_attr( self::OPT ) . '[exclude_duplicates]" value="1"' . checked( 1, (int) self::opt( 'exclude_duplicates' ), false ) . '> Escludi i contatti doppi dal report</label>';
		echo '<p class="description">Doppio = stesso raggruppamento scelto nel report (form, utm_campaign o utm_campaign_new) + stesso nome + stesso cognome + stessa email, nel periodo selezionato. Viene contato il primo invio.</p></td></tr>';
		echo '</tbody></table>';

		submit_button( 'Salva impostazioni' );
		echo '</form>';

		echo '<hr><h2>Rielabora contatti esistenti</h2>';
		echo '<p>Se hai cambiato il nome dei campi email / nome / cognome, puoi riapplicarli ai contatti già salvati (rilegge i dati originali di ogni invio e aggiorna email, nome, cognome e UTM). Salva prima le impostazioni. L\'elaborazione avviene in background a lotti di 1000 contatti.</p>';
		$st = get_option( 'cf7sdb_reprocess' );
		if ( is_array( $st ) ) {
			echo '<p><strong>Stato:</strong> ' . ( ! empty( $st['running'] ) ? 'in corso, ' . (int) $st['done'] . ' contatti elaborati finora…' : 'completata (' . (int) $st['done'] . ' contatti elaborati).' ) . '</p>';
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" onsubmit="return confirm(\'Rielaborare tutti i contatti?\')">';
		echo '<input type="hidden" name="action" value="cf7sdb_reprocess">';
		wp_nonce_field( 'cf7sdb_reprocess' );
		submit_button( 'Rielabora ora', 'secondary', 'submit', false );
		echo '</form></div>';
	}

	private static function field_text( $key, $label ) {
		printf(
			'<tr><th scope="row"><label for="cf7sdb-%1$s">%2$s</label></th><td><input type="text" id="cf7sdb-%1$s" name="%3$s[%1$s]" value="%4$s" class="regular-text code"></td></tr>',
			esc_attr( $key ),
			esc_html( $label ),
			esc_attr( self::OPT ),
			esc_attr( self::opt( $key ) )
		);
	}

	/* ------------------------------------------------------------------
	 * Eliminazione (singola e bulk)
	 * ---------------------------------------------------------------- */

	public static function handle_delete() {
		global $wpdb;
		if ( ! current_user_can( self::CAP ) ) {
			return;
		}
		$ids = array();

		if ( isset( $_GET['cf7sdb_del'] ) ) {
			$id = absint( $_GET['cf7sdb_del'] );
			check_admin_referer( 'cf7sdb_delete_' . $id );
			$ids = array( $id );
		} else {
			$action = $_REQUEST['action'] ?? '';
			if ( '-1' === $action || '' === $action ) {
				$action = $_REQUEST['action2'] ?? '';
			}
			if ( 'delete' === $action && ! empty( $_REQUEST['ids'] ) ) {
				check_admin_referer( 'bulk-submissions' );
				$ids = array_filter( array_map( 'absint', (array) $_REQUEST['ids'] ) );
			}
		}

		if ( $ids ) {
			$t  = self::table();
			$in = implode( ',', array_map( 'intval', $ids ) );
			$wpdb->query( "DELETE FROM $t WHERE id IN ($in)" ); // phpcs:ignore
			delete_transient( 'cf7sdb_forms' );
			wp_safe_redirect( admin_url( 'admin.php?page=cf7sdb&deleted=' . count( $ids ) ) );
			exit;
		}
	}

	/* ------------------------------------------------------------------
	 * Pagina: lista contatti / dettaglio
	 * ---------------------------------------------------------------- */

	public static function page_list() {
		if ( ! current_user_can( self::view_cap() ) ) {
			wp_die( 'Permessi insufficienti.' );
		}
		if ( ! empty( $_GET['view'] ) ) {
			self::page_detail( absint( $_GET['view'] ) );
			return;
		}

		$f     = self::list_filters();
		$table = new CF7SDB_List_Table();
		$table->prepare_items();

		$export_url = wp_nonce_url(
			add_query_arg( array_merge( array( 'action' => 'cf7sdb_export' ), array_filter( $f ) ), admin_url( 'admin-post.php' ) ),
			'cf7sdb_export'
		);

		echo '<div class="wrap"><h1 class="wp-heading-inline">Contatti Contact Form 7</h1>';
		echo ' <a href="' . esc_url( $export_url ) . '" class="page-title-action">Esporta CSV (con filtri attivi)</a><hr class="wp-header-end">';

		if ( isset( $_GET['deleted'] ) ) {
			echo '<div class="notice notice-success is-dismissible"><p>' . (int) $_GET['deleted'] . ' contatti eliminati.</p></div>';
		}

		// Form filtri (GET).
		echo '<form method="get" style="margin:12px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:end">';
		echo '<input type="hidden" name="page" value="cf7sdb">';
		echo '<label>Dal<br><input type="date" name="date_from" value="' . esc_attr( $f['date_from'] ) . '"></label>';
		echo '<label>Al<br><input type="date" name="date_to" value="' . esc_attr( $f['date_to'] ) . '"></label>';
		echo '<label>Form<br><select name="form_id"><option value="0">Tutti</option>';
		foreach ( self::forms_options() as $o ) {
			printf( '<option value="%d"%s>%s (#%d)</option>', (int) $o->form_id, selected( $f['form_id'], (int) $o->form_id, false ), esc_html( $o->title ), (int) $o->form_id );
		}
		echo '</select></label>';
		echo '<label>Email<br><input type="text" name="email" value="' . esc_attr( $f['email'] ) . '" placeholder="contiene..."></label>';
		echo '<label>Ricerca libera<br><input type="search" name="s" value="' . esc_attr( $f['s'] ) . '" placeholder="in tutti i campi"></label>';
		echo '<button class="button button-primary">Filtra</button> ';
		echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=cf7sdb' ) ) . '">Reset</a>';
		echo '</form>';

		// Form tabella (POST per le azioni bulk).
		echo '<form method="post">';
		$table->display();
		echo '</form></div>';
	}

	private static function page_detail( $id ) {
		global $wpdb;
		$t   = self::table();
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore

		echo '<div class="wrap"><h1>Contatto #' . (int) $id . '</h1>';
		echo '<p><a href="' . esc_url( admin_url( 'admin.php?page=cf7sdb' ) ) . '">&larr; Torna alla lista</a></p>';
		if ( ! $row ) {
			echo '<p>Contatto non trovato.</p></div>';
			return;
		}

		$meta = array(
			'Data'       => $row['submitted_at'],
			'Form'       => $row['form_title'] . ' (#' . $row['form_id'] . ')',
			'Nome'       => $row['first_name'],
			'Cognome'    => $row['last_name'],
			'Email'      => $row['email'],
			'IP'         => $row['ip'],
			'User agent' => $row['user_agent'],
			'Pagina'     => $row['page_url'],
		);
		echo '<h2>Informazioni</h2><table class="widefat striped" style="max-width:900px"><tbody>';
		foreach ( $meta as $k => $v ) {
			echo '<tr><th style="width:200px">' . esc_html( $k ) . '</th><td>' . esc_html( $v ) . '</td></tr>';
		}
		echo '</tbody></table>';

		echo '<h2>Campi compilati</h2><table class="widefat striped" style="max-width:900px"><tbody>';
		foreach ( (array) json_decode( $row['data'], true ) as $k => $v ) {
			$v = is_array( $v ) ? implode( ', ', $v ) : $v;
			echo '<tr><th style="width:200px">' . esc_html( $k ) . '</th><td>' . nl2br( esc_html( $v ) ) . '</td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/* ------------------------------------------------------------------
	 * Export CSV della lista (tutti i campi, anche dinamici)
	 * ---------------------------------------------------------------- */

	public static function export_list() {
		global $wpdb;
		if ( ! current_user_can( self::view_cap() ) ) {
			wp_die( 'Permessi insufficienti.' );
		}
		check_admin_referer( 'cf7sdb_export' );

		$f = self::list_filters();
		list( $w, $p ) = self::where( $f );
		$t = self::table();

		// Chiavi già rappresentate da colonne fisse: non le ripeto tra i campi dinamici.
		$skip = array_flip( array_merge(
			self::UTM,
			array(
				self::norm_key( self::opt( 'email_field' ) ),
				self::norm_key( self::opt( 'first_name_field' ) ),
				self::norm_key( self::opt( 'last_name_field' ) ),
			)
		) );

		// Passata 1: elenco di tutte le chiavi presenti nei dati filtrati.
		$keys = array();
		$last = 0;
		do {
			$sql  = "SELECT id, data FROM $t WHERE $w AND id > %d ORDER BY id ASC LIMIT 500";
			$rows = $wpdb->get_results( self::prep( $sql, array_merge( $p, array( $last ) ) ), ARRAY_A ); // phpcs:ignore
			foreach ( $rows as $r ) {
				$last = (int) $r['id'];
				foreach ( (array) json_decode( $r['data'], true ) as $k => $v ) {
					if ( ! isset( $skip[ self::norm_key( $k ) ] ) ) {
						$keys[ $k ] = true;
					}
				}
			}
		} while ( 500 === count( $rows ) );
		$keys = array_keys( $keys );
		$utm  = self::utm_fields();

		// Passata 2: scrittura.
		$out = self::csv_start( 'contatti-cf7-' . wp_date( 'Ymd-His' ) . '.csv' );
		self::csv_row( $out, array_merge(
			array( 'ID', 'Data', 'Form ID', 'Form', 'Nome', 'Cognome', 'Email', 'IP', 'Pagina' ),
			$utm,
			$keys
		) );

		$last = 0;
		do {
			$sql  = "SELECT * FROM $t WHERE $w AND id > %d ORDER BY id ASC LIMIT 500";
			$rows = $wpdb->get_results( self::prep( $sql, array_merge( $p, array( $last ) ) ), ARRAY_A ); // phpcs:ignore
			foreach ( $rows as $r ) {
				$last = (int) $r['id'];
				$data = (array) json_decode( $r['data'], true );
				$line = array( $r['id'], $r['submitted_at'], $r['form_id'], $r['form_title'], $r['first_name'], $r['last_name'], $r['email'], $r['ip'], $r['page_url'] );
				$nm = array();
				foreach ( $data as $k => $v ) {
					$nm[ self::norm_key( $k ) ] = is_array( $v ) ? implode( ', ', $v ) : $v;
				}
				foreach ( $utm as $u ) {
					$line[] = ( isset( $nm[ $u ] ) && '' !== $nm[ $u ] ) ? $nm[ $u ] : $r[ $u ]; // valore completo dal JSON (la colonna è limitata a 190 car.)
				}
				foreach ( $keys as $k ) {
					$line[] = isset( $data[ $k ] ) ? $data[ $k ] : '';
				}
				self::csv_row( $out, $line );
			}
		} while ( 500 === count( $rows ) );

		fclose( $out );
		exit;
	}

	/* ------------------------------------------------------------------
	 * Report aggregato
	 * ---------------------------------------------------------------- */

	private static function report_filters() {
		$range = sanitize_key( $_GET['range'] ?? 'current' );
		$now   = current_datetime();

		if ( 'last' === $range ) {
			$from = $now->modify( 'first day of last month' )->format( 'Y-m-d' );
			$to   = $now->modify( 'last day of last month' )->format( 'Y-m-d' );
		} elseif ( 'custom' === $range ) {
			$from = self::valid_date( wp_unslash( $_GET['date_from'] ?? '' ) );
			$to   = self::valid_date( wp_unslash( $_GET['date_to'] ?? '' ) );
			$from = $from ? $from : $now->modify( 'first day of this month' )->format( 'Y-m-d' );
			$to   = $to ? $to : $now->format( 'Y-m-d' );
		} else {
			$range = 'current';
			$from  = $now->modify( 'first day of this month' )->format( 'Y-m-d' );
			$to    = $now->modify( 'last day of this month' )->format( 'Y-m-d' );
		}

		$group = sanitize_key( $_GET['group_by'] ?? 'form_id' );
		if ( ! isset( self::groups()[ $group ] ) ) {
			$group = 'form_id';
		}

		return array(
			'range'     => $range,
			'date_from' => $from,
			'date_to'   => $to,
			'group_by'  => $group,
			'form_id'   => absint( $_GET['form_id'] ?? 0 ),
		);
	}

	/**
	 * Dati del report, già depurati da contatti di test e (se attivo) duplicati.
	 *
	 * @return array { groups: [ key => [label,total,rows[]] ], raw, tests, dups, final }
	 */
	private static function report_data( $rf ) {
		global $wpdb;
		$t   = self::table();
		$col = $rf['group_by']; // già validato in whitelist

		$base = array(
			'date_from' => $rf['date_from'],
			'date_to'   => $rf['date_to'],
			'form_id'   => $rf['form_id'],
		);

		// 1) Conteggio grezzo nel periodo.
		list( $wa, $pa ) = self::where( $base );
		$raw = (int) $wpdb->get_var( self::prep( "SELECT COUNT(*) FROM $t WHERE $wa", $pa ) ); // phpcs:ignore

		// 2) Esclusione contatti di test.
		list( $w, $p ) = self::where( array_merge( $base, array( 'exclude_emails' => self::test_emails() ) ) );
		$clean = (int) $wpdb->get_var( self::prep( "SELECT COUNT(*) FROM $t WHERE $w", $p ) ); // phpcs:ignore

		// 3) Esclusione duplicati: tengo il primo invio per (gruppo + nome + cognome + email).
		//    Contatti senza nome/cognome/email non sono deduplicabili: restano tutti.
		if ( self::opt( 'exclude_duplicates' ) ) {
			$key  = "IF(email = '' AND first_name = '' AND last_name = '', CONCAT('#', id), CONCAT_WS('|', LOWER(first_name), LOWER(last_name), LOWER(email)))";
			$from = "$t INNER JOIN (SELECT MIN(id) AS mid FROM $t WHERE $w GROUP BY $col, $key) d ON d.mid = $t.id";
			$cond = '1=1';
		} else {
			$from = $t;
			$cond = $w;
		}

		$totals = $wpdb->get_results( self::prep( "SELECT $col AS g, MAX(form_title) AS title, COUNT(*) AS c FROM $from WHERE $cond GROUP BY $col ORDER BY c DESC", $p ), ARRAY_A ); // phpcs:ignore
		$detail = $wpdb->get_results( self::prep( "SELECT $col AS g, utm_source, utm_medium, utm_term, utm_content, COUNT(*) AS c FROM $from WHERE $cond GROUP BY $col, utm_source, utm_medium, utm_term, utm_content ORDER BY c DESC", $p ), ARRAY_A ); // phpcs:ignore

		$groups = array();
		$final  = 0;
		foreach ( $totals as $r ) {
			if ( 'form_id' === $col ) {
				$label = ( '' !== $r['title'] ? $r['title'] : 'Form' ) . ' (#' . $r['g'] . ')';
			} else {
				$label = '' !== $r['g'] ? $r['g'] : '(non valorizzato)';
			}
			$groups[ (string) $r['g'] ] = array( 'label' => $label, 'total' => (int) $r['c'], 'rows' => array() );
			$final                     += (int) $r['c'];
		}
		foreach ( $detail as $r ) {
			$groups[ (string) $r['g'] ]['rows'][] = $r;
		}

		return array(
			'groups' => $groups,
			'raw'    => $raw,
			'tests'  => $raw - $clean,
			'dups'   => $clean - $final,
			'final'  => $final,
		);
	}

	public static function page_report() {
		if ( ! current_user_can( self::view_cap() ) ) {
			wp_die( 'Permessi insufficienti.' );
		}
		$rf  = self::report_filters();
		$rep = self::report_data( $rf );

		$export_url = wp_nonce_url(
			add_query_arg( array_merge( array( 'action' => 'cf7sdb_export_report' ), $rf ), admin_url( 'admin-post.php' ) ),
			'cf7sdb_export_report'
		);

		echo '<div class="wrap"><h1 class="wp-heading-inline">Report contatti</h1>';
		echo ' <a href="' . esc_url( $export_url ) . '" class="page-title-action">Esporta CSV</a><hr class="wp-header-end">';

		echo '<form method="get" style="margin:12px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:end">';
		echo '<input type="hidden" name="page" value="cf7sdb-report">';
		echo '<label>Periodo<br><select name="range">';
		foreach ( array( 'current' => 'Mese corrente', 'last' => 'Mese scorso', 'custom' => 'Date libere' ) as $k => $l ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $k ), selected( $rf['range'], $k, false ), esc_html( $l ) );
		}
		echo '</select></label>';
		echo '<label>Dal (date libere)<br><input type="date" name="date_from" value="' . esc_attr( $rf['date_from'] ) . '"></label>';
		echo '<label>Al (date libere)<br><input type="date" name="date_to" value="' . esc_attr( $rf['date_to'] ) . '"></label>';
		echo '<label>Raggruppa per<br><select name="group_by">';
		foreach ( self::groups() as $k => $l ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $k ), selected( $rf['group_by'], $k, false ), esc_html( $l ) );
		}
		echo '</select></label>';
		echo '<label>Solo form<br><select name="form_id"><option value="0">Tutti</option>';
		foreach ( self::forms_options() as $o ) {
			printf( '<option value="%d"%s>%s (#%d)</option>', (int) $o->form_id, selected( $rf['form_id'], (int) $o->form_id, false ), esc_html( $o->title ), (int) $o->form_id );
		}
		echo '</select></label>';
		echo '<button class="button button-primary">Aggiorna</button>';
		echo '</form>';

		echo '<p>Periodo: <strong>' . esc_html( $rf['date_from'] ) . '</strong> &rarr; <strong>' . esc_html( $rf['date_to'] ) . '</strong></p>';
		echo '<p style="background:#fff;border-left:4px solid #2271b1;padding:8px 12px;max-width:1100px">';
		echo 'Contatti nel periodo: <strong>' . (int) $rep['raw'] . '</strong> &minus; test esclusi: <strong>' . (int) $rep['tests'] . '</strong>';
		echo ' &minus; duplicati esclusi: <strong>' . (int) $rep['dups'] . '</strong>';
		echo ' = <strong style="font-size:15px">' . (int) $rep['final'] . '</strong> contatti validi. ';
		echo '<a href="' . esc_url( admin_url( 'admin.php?page=cf7sdb-settings' ) ) . '">Impostazioni</a></p>';

		echo '<p><a href="#" onclick="document.querySelectorAll(\'.cf7sdb-grp\').forEach(function(d){d.open=true});return false;">Espandi tutto</a> / ';
		echo '<a href="#" onclick="document.querySelectorAll(\'.cf7sdb-grp\').forEach(function(d){d.open=false});return false;">Comprimi tutto</a></p>';

		if ( ! $rep['groups'] ) {
			echo '<p>Nessun contatto nel periodo selezionato.</p></div>';
			return;
		}

		foreach ( $rep['groups'] as $g ) {
			echo '<details class="cf7sdb-grp" style="background:#fff;border:1px solid #c3c4c7;margin:0 0 8px;max-width:1100px">';
			echo '<summary style="padding:10px 12px;cursor:pointer;font-size:14px"><strong>' . esc_html( $g['label'] ) . '</strong> &mdash; ' . (int) $g['total'] . ' contatti</summary>';
			echo '<table class="widefat striped" style="border:0"><thead><tr><th>utm_source</th><th>utm_medium</th><th>utm_term</th><th>utm_content</th><th style="width:90px;text-align:right">Contatti</th></tr></thead><tbody>';
			foreach ( $g['rows'] as $r ) {
				echo '<tr>';
				foreach ( array( 'utm_source', 'utm_medium', 'utm_term', 'utm_content' ) as $c ) {
					echo '<td>' . ( '' !== $r[ $c ] ? esc_html( $r[ $c ] ) : '<span style="color:#999">—</span>' ) . '</td>';
				}
				echo '<td style="text-align:right"><strong>' . (int) $r['c'] . '</strong></td></tr>';
			}
			echo '</tbody></table></details>';
		}
		echo '</div>';
	}

	public static function export_report() {
		if ( ! current_user_can( self::view_cap() ) ) {
			wp_die( 'Permessi insufficienti.' );
		}
		check_admin_referer( 'cf7sdb_export_report' );

		$rf  = self::report_filters();
		$rep = self::report_data( $rf );
		$out = self::csv_start( 'report-cf7-' . $rf['group_by'] . '-' . $rf['date_from'] . '_' . $rf['date_to'] . '.csv' );

		self::csv_row( $out, array( self::groups()[ $rf['group_by'] ], 'Totale gruppo', 'utm_source', 'utm_medium', 'utm_term', 'utm_content', 'Contatti' ) );
		foreach ( $rep['groups'] as $g ) {
			foreach ( $g['rows'] as $r ) {
				self::csv_row( $out, array( $g['label'], $g['total'], $r['utm_source'], $r['utm_medium'], $r['utm_term'], $r['utm_content'], $r['c'] ) );
			}
		}
		fclose( $out );
		exit;
	}
}

/* ----------------------------------------------------------------------
 * WP_List_Table
 * -------------------------------------------------------------------- */
if ( is_admin() ) {

	class CF7SDB_List_Table extends WP_List_Table {

		public function __construct() {
			parent::__construct( array( 'singular' => 'submission', 'plural' => 'submissions', 'ajax' => false ) );
		}

		public function get_columns() {
			$cols = array(
				'cb'           => '<input type="checkbox">',
				'id'           => 'ID',
				'submitted_at' => 'Data',
				'form'         => 'Form',
				'first_name'   => 'Nome',
				'last_name'    => 'Cognome',
				'email'        => 'Email',
				'utm_campaign' => 'utm_campaign',
			);
			if ( CF7SDB::opt( 'use_campaign_new' ) ) {
				$cols['utm_campaign_new'] = 'utm_campaign_new';
			}
			$cols['source_medium'] = 'Source / Medium';
			if ( ! current_user_can( CF7SDB::CAP ) ) {
				unset( $cols['cb'] ); // chi può solo consultare non vede checkbox di eliminazione
			}
			return $cols;
		}

		protected function get_sortable_columns() {
			return array(
				'id'           => array( 'id', true ),
				'submitted_at' => array( 'submitted_at', true ),
				'first_name'   => array( 'first_name', false ),
				'last_name'    => array( 'last_name', false ),
				'email'        => array( 'email', false ),
			);
		}

		protected function get_bulk_actions() {
			return current_user_can( CF7SDB::CAP ) ? array( 'delete' => 'Elimina' ) : array();
		}

		protected function column_cb( $item ) {
			return '<input type="checkbox" name="ids[]" value="' . (int) $item['id'] . '">';
		}

		protected function column_id( $item ) {
			$id      = (int) $item['id'];
			$view    = admin_url( 'admin.php?page=cf7sdb&view=' . $id );
			$del     = wp_nonce_url( admin_url( 'admin.php?page=cf7sdb&cf7sdb_del=' . $id ), 'cf7sdb_delete_' . $id );
			$actions = array(
				'view' => '<a href="' . esc_url( $view ) . '">Dettaglio</a>',
			);
			if ( current_user_can( CF7SDB::CAP ) ) {
				$actions['delete'] = '<a href="' . esc_url( $del ) . '" onclick="return confirm(\'Eliminare questo contatto?\')" style="color:#b32d2e">Elimina</a>';
			}
			return '<strong><a href="' . esc_url( $view ) . '">#' . $id . '</a></strong>' . $this->row_actions( $actions );
		}

		protected function column_form( $item ) {
			return esc_html( $item['form_title'] ) . ' <span style="color:#888">(#' . (int) $item['form_id'] . ')</span>';
		}

		protected function column_source_medium( $item ) {
			$parts = array_filter( array( $item['utm_source'], $item['utm_medium'] ) );
			return $parts ? esc_html( implode( ' / ', $parts ) ) : '—';
		}

		protected function column_default( $item, $col ) {
			return isset( $item[ $col ] ) && '' !== $item[ $col ] ? esc_html( $item[ $col ] ) : '—';
		}

		public function no_items() {
			echo 'Nessun contatto trovato.';
		}

		public function prepare_items() {
			global $wpdb;
			$t     = CF7SDB::table();
			$per   = 25;
			$paged = $this->get_pagenum();
			list( $w, $p ) = CF7SDB::where( CF7SDB::list_filters() );

			$orderby = isset( $_GET['orderby'] ) && in_array( $_GET['orderby'], array( 'id', 'submitted_at', 'email', 'first_name', 'last_name' ), true ) ? $_GET['orderby'] : 'id';
			$order   = isset( $_GET['order'] ) && 'asc' === strtolower( $_GET['order'] ) ? 'ASC' : 'DESC';

			$count_sql = "SELECT COUNT(*) FROM $t WHERE $w";
			$total     = (int) ( $p ? $wpdb->get_var( $wpdb->prepare( $count_sql, $p ) ) : $wpdb->get_var( $count_sql ) ); // phpcs:ignore

			$sql = "SELECT id, form_id, form_title, submitted_at, first_name, last_name, email, utm_source, utm_medium, utm_campaign, utm_campaign_new
					FROM $t WHERE $w ORDER BY $orderby $order LIMIT %d OFFSET %d";
			$this->items = $wpdb->get_results( $wpdb->prepare( $sql, array_merge( $p, array( $per, ( $paged - 1 ) * $per ) ) ), ARRAY_A ); // phpcs:ignore

			$this->_column_headers = array( $this->get_columns(), array(), $this->get_sortable_columns() );
			$this->set_pagination_args( array( 'total_items' => $total, 'per_page' => $per ) );
		}
	}
}

CF7SDB::init();