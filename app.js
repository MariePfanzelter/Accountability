/* Accountability – lokale Web-App (Daten im Browser via localStorage) */
(() => {
  'use strict';

  const STORE_KEY = 'accountability.v1';

  /* ================= Feste Struktur ================= */
  // Alle Metriken, die du täglich dokumentierst
  const METRICS = [
    // Tägliche ToDos
    { key: 'tiktok_gepostet', label: 'TikToks gepostet', section: 'daily' },
    { key: 'tiktok_ka', label: 'Kaltakquise TikTok', short: 'KA TikTok', section: 'daily', part: 'contacts' },
    { key: 'tiktok_liker', label: 'Liker TikTok', section: 'daily', part: 'contacts' },
    { key: 'tiktok_neue_follower', label: 'Neue Follower', section: 'daily', part: 'contacts' },
    { key: 'instagram_testreelliker', label: 'Liker Instagram', section: 'daily', part: 'contacts' },
    { key: 'instagram_testreels', label: 'Testreel', section: 'daily' },
    { key: 'instagram_stories', label: 'Story', section: 'daily' },
    { key: 'pd_text', label: 'Persönlichkeitsentwicklung', short: 'Persönlichkeitsentw.', section: 'daily', type: 'text' },
    // Wöchentliche ToDos
    { key: 'instagram_sprechstories', label: 'Sprechstory', section: 'weekly' },
    { key: 'tiktok_sprechtiktoks', label: 'Sprech-TikTok', section: 'weekly' },
    // Outcome
    { key: 'sales_nummern', label: 'Nummern', section: 'outcome', plan: 'nummern' },
    { key: 'sales_fcs', label: 'First Calls', section: 'outcome', plan: 'fcs' },
    { key: 'sales_praesis', label: 'Präsis rausgeschickt', short: 'Präsis', section: 'outcome', plan: 'praesis' },
    { key: 'sales_closing', label: 'Closings', section: 'outcome', plan: 'closings' },
    { key: 'sales_fu_closing', label: 'Follow-up Closings', short: 'FU Closings', section: 'outcome' },
    { key: 'sales_neins', label: 'Neins gesammelt', short: 'Neins', section: 'outcome' },
    { key: 'quali_starter', label: 'Starter', section: 'outcome', plan: 'starter' },
    { key: 'quali_volume', label: 'Volumen (BV)', short: 'BV', section: 'outcome', plan: 'bv', wide: true },
    { key: 'team_closing', label: 'Closings im Team', short: 'Team Closings', section: 'team' },
    { key: 'team_starter', label: 'Starter im Team', short: 'Team Starter', section: 'team' },
    // Pro Cycle
    { key: 'pro_cycle_followups', label: 'Alle Kontakte nachgefasst', short: 'Nachgefasst', section: 'cycle' },
    { key: 'pro_cycle_offline_meetings', label: 'Offline Meeting organisiert', short: 'Offline Meeting', section: 'cycle' },
    { key: 'pro_cycle_checkups', label: 'Checkups', section: 'cycle' },
  ];
  const M = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  const CONTACT_KEYS = METRICS.filter((m) => m.part === 'contacts').map((m) => m.key);

  // ToDos mit Zielen (goal = Schlüssel in settings.goals)
  const DAILY_TODOS = [
    { id: 'tiktok', label: 'TikToks gepostet', keys: ['tiktok_gepostet'] },
    { id: 'contacts', label: 'Kontakte angeschrieben', keys: CONTACT_KEYS },
    { id: 'testreel', label: 'Testreel gepostet', keys: ['instagram_testreels'] },
    { id: 'story', label: 'Story gepostet', keys: ['instagram_stories'] },
    { id: 'pd', label: 'Persönlichkeitsentwicklung', keys: ['pd', 'pd_text'], text: true },
  ];
  const WEEKLY_TODOS = [
    { id: 'sprechstory', label: 'Sprechstory', keys: ['instagram_sprechstories'] },
    { id: 'sprechtiktok', label: 'Sprech-TikToks', keys: ['tiktok_sprechtiktoks'] },
  ];
  const CYCLE_TODOS = [
    { id: 'followups', label: 'Alle Kontakte nachgefasst', keys: ['pro_cycle_followups'] },
    { id: 'offline', label: 'Offline Meeting organisiert', keys: ['pro_cycle_offline_meetings'] },
  ];
  const DEFAULT_GOALS = { tiktok: 3, contacts: 100, testreel: 1, story: 1, pd: 1, sprechstory: 1, sprechtiktok: 2, followups: 1, offline: 1, closingsWeek: null, starterWeek: null };

  // Rank-Tabelle (BV pro Bein, Residual pro Paid Cycle)
  const RANKS = [
    { name: 'Executive', leg: 550, pay: 100 },
    { name: 'Consultant', leg: 1200, pay: 500 },
    { name: 'Team Leader', leg: 4000, pay: 1500 },
    { name: 'Advanced Team Leader', leg: 9000, pay: 2500 },
    { name: 'Senior Team Leader', leg: 14000, pay: 4000 },
    { name: 'Executive Team Leader', leg: 29500, pay: 8500 },
    { name: 'Vice President', leg: 60000, pay: 15000 },
    { name: 'Senior Vice President', leg: 90000, pay: 30000 },
    { name: 'Executive Vice President', leg: 180000, pay: 60000 },
    { name: 'Global Director', leg: 370000, pay: 120000 },
  ];
  const rankByName = (n) => RANKS.find((r) => r.name === n) || null;
  const nextRank = (achieved) => { const i = RANKS.findIndex((r) => r.name === achieved); return RANKS[Math.min(RANKS.length - 1, i + 1)]; };
  const PLAN_WEEKS = 4;

  const STATUS = {
    done: { label: 'done', icon: '✓' },
    nearly: { label: 'nearly done', icon: '◐' },
    onway: { label: 'on my way', icon: '→' },
    missing: { label: 'missing', icon: '–' },
    logged: { label: 'eingetragen', icon: '•' },
  };

  /* ================= Helfer ================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const todayISO = () => isoOf(new Date());
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const fmtShort = (s) => { const d = parse(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
  const fmtDay = (s) => `${WD[parse(s).getDay()]}, ${fmtShort(s)}`;
  const fmtCycle = (s) => parse(s).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLong = (s) => parse(s).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const fmt = (n) => nf.format(n || 0);
  const money = (n) => `$${new Intl.NumberFormat('de-DE').format(n)}`;
  const slug = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  function parseNum(raw) {
    let s = String(raw ?? '').trim().replace(/\s/g, '');
    if (s === '') return null;
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

  /* ================= Daten ================= */
  function historyRates(cycles) {
    const t = {};
    for (const c of cycles) for (const e of Object.values(c.entries || {})) for (const k of ['sales_nummern', 'sales_fcs', 'sales_praesis', 'sales_closing', 'quali_starter', 'quali_volume']) {
      if (typeof e[k] === 'number') t[k] = (t[k] || 0) + e[k];
    }
    const pct = (a, b, def) => (a > 0 && b > 0 ? Math.max(5, Math.min(100, Math.round((a / b) * 100))) : def);
    return {
      bvPerStarter: t.quali_starter > 0 && t.quali_volume > 0 ? Math.round(t.quali_volume / t.quali_starter / 25) * 25 : 800,
      starterPerClosing: pct(t.quali_starter, t.sales_closing, 25),
      closingPerPraesi: pct(t.sales_closing, t.sales_praesis, 60),
      praesiPerFc: pct(t.sales_praesis, t.sales_fcs, 90),
      fcPerNummer: pct(t.sales_fcs, t.sales_nummern, 50),
    };
  }

  // Altes Format (pro Cycle konfigurierte Metriken) -> neues, schlichtes Format
  function migrate(d) {
    if (d.version === 2) return d;
    const cycles = (d.cycles || []).map((c) => ({
      id: c.id, name: c.name, start: c.start, length: c.length,
      targetRank: null, weekNotes: c.weekNotes || [], entries: c.entries || {},
    }));
    cycles.sort((a, b) => a.start.localeCompare(b.start));
    const settings = { achievedRank: 'Team Leader', goals: { ...DEFAULT_GOALS }, rates: historyRates(cycles), baseBV: 0 };
    const t = todayISO();
    const cur = cycles.find((c) => t >= c.start && t <= addDays(c.start, c.length - 1)) || cycles[cycles.length - 1];
    if (cur) cur.targetRank = nextRank(settings.achievedRank).name;
    return { version: 2, settings, cycles };
  }

  // Sicherheitskopie: wird bei jedem Speichern mitgeschrieben und greift, falls der Hauptspeicher fehlt/kaputt ist.
  // Updates der App (neue Version auf GitHub) ändern nur den Code – die Einträge im Browser bleiben erhalten.
  const BACKUP_KEY = STORE_KEY + '.backup';
  function load() {
    for (const key of [STORE_KEY, BACKUP_KEY]) {
      const raw = lsGet(key);
      if (raw) { try { const d = JSON.parse(raw); if (d && Array.isArray(d.cycles)) return migrate(d); } catch { /* nächster */ } }
    }
    if (window.SEED_DATA) return migrate(clone(window.SEED_DATA));
    return migrate({ cycles: [] });
  }
  let state = load();
  function normalize(s = state) {
    s.settings.goals = { ...DEFAULT_GOALS, ...s.settings.goals };
    s.deleted = s.deleted || {};
    s.marketing = Array.isArray(s.marketing) ? s.marketing.filter((m) => m && m.id && !s.deleted[m.id]) : [];
    // Chat-Vorlagen einmalig hinzufügen (gelöschte bleiben gelöscht, bearbeitete bleiben bearbeitet)
    s.marketing = s.marketing.filter((m) => m.id !== 's-wa-2');
    s.marketing.forEach((m) => { if (m.text && m.text.includes('{Name}')) m.text = m.text.replace(/\s?\{Name\}/g, ''); });
    const have = new Set(s.marketing.map((m) => m.id));
    (window.MK_SEED || []).forEach((m, i) => { if (!have.has(m.id) && !s.deleted[m.id]) s.marketing.push({ ...m, url: '', fav: false, order: i + 1, created: 0, ts: 0 }); });
    s.cycles.sort((a, b) => a.start.localeCompare(b.start));
    // Cycles laufen automatisch weiter: immer 28 Tage, nahtlos aneinander.
    // Feste ID je Startdatum, damit zwei Geräte denselben Cycle anlegen und kein Duplikat entsteht.
    const today = todayISO();
    let last = s.cycles[s.cycles.length - 1];
    while (last && addDays(last.start, last.length - 1) < today) {
      const start = addDays(last.start, last.length), num = Number((last.name.match(/Cycle\s*(\d+)/i) || [])[1]);
      const id = `auto-${start}`;
      if (s.deleted[id]) delete s.deleted[id];
      last = { id, name: num ? `Cycle ${num + 1}` : 'Cycle', start, length: 28, targetRank: null, weekNotes: [], entries: {}, ts: {}, metaTs: 0 };
      s.cycles.push(last);
    }
    // Ziel ist immer der Rank nach dem höchsten erreichten (aktueller + zukünftige Cycles)
    const goalRank = nextRank(s.settings.achievedRank).name;
    for (const c of s.cycles) if (addDays(c.start, c.length - 1) >= today) c.targetRank = goalRank;
    for (const c of s.cycles) {
      c.entries = c.entries || {};
      c.ts = c.ts || {};
      c.weekNotes = Array.from({ length: weeksOf(c) }, (_, i) => c.weekNotes?.[i] || '');
    }
    return s;
  }

  let saveTimer;
  function save() {
    setSaveState('Speichert …');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = writeNow();
      if (!ok) setSaveState('⚠ Speichern fehlgeschlagen');
      else if (sync) scheduleSync(); else setSaveState('✓ Gespeichert');
    }, 250);
  }
  function writeNow() {
    const str = JSON.stringify(state);
    const ok = lsSet(STORE_KEY, str);
    if (ok) lsSet(BACKUP_KEY, str);
    return ok;
  }
  // Beim Schließen/Wegwechseln sofort speichern (nicht erst nach der kurzen Verzögerung)
  const flush = () => { clearTimeout(saveTimer); writeNow(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  // Browser bitten, die Daten dauerhaft zu behalten (schützt v. a. auf dem iPhone vor automatischem Löschen)
  try { navigator.storage?.persist?.(); } catch { /* egal */ }
  function setSaveState(t) { $('#saveState').textContent = t; }
  const touchSettings = () => { state.settings.ts = Date.now(); };
  const touchCycle = (c) => { c.metaTs = Date.now(); };

  /* ================= Sync über geheimen GitHub-Gist ================= */
  // Token + Gist-ID liegen NUR lokal auf dem Gerät (nie in den synchronisierten Daten).
  const SYNC_KEY = 'acc.sync', GIST_FILE = 'accountability-data.json';
  let sync = null;
  try { sync = JSON.parse(lsGet(SYNC_KEY) || 'null'); } catch { sync = null; }
  let syncBusy = false, syncAgain = false, syncTimer = null, pendingRender = false;
  let lastSync = null;

  async function gh(path, opts = {}) {
    const r = await fetch(`https://api.github.com${path}`, {
      cache: 'no-store', ...opts,
      headers: { Authorization: `Bearer ${sync.token}`, Accept: 'application/vnd.github+json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  async function findGist() {
    for (let p = 1; p <= 10; p++) {
      const list = await gh(`/gists?per_page=100&page=${p}`);
      const g = list.find((x) => x.files && x.files[GIST_FILE]);
      if (g) return g.id;
      if (list.length < 100) break;
    }
    return null;
  }
  async function readGist() {
    const g = await gh(`/gists/${sync.gistId}`);
    const f = g.files[GIST_FILE];
    if (!f) return null;
    const txt = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    return JSON.parse(txt);
  }
  const writeGist = (data) => gh(`/gists/${sync.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(data) } } }) });

  // Zusammenführen: pro Tag gewinnt der neuere Eintrag, Cycle-Daten/Einstellungen nach Zeitstempel
  function mergeStates(local, remote) {
    const out = clone(local);
    for (const [id, t] of Object.entries(remote.deleted || {})) out.deleted[id] = Math.max(out.deleted[id] || 0, t);
    const localEmpty = !local.cycles.length && !local.settings.ts;
    if (remote.settings && ((remote.settings.ts || 0) > (out.settings.ts || 0) || localEmpty)) out.settings = clone(remote.settings);
    const byId = new Map(out.cycles.map((c) => [c.id, c]));
    for (const rc of remote.cycles || []) {
      const lc = byId.get(rc.id);
      if (!lc) { byId.set(rc.id, clone(rc)); continue; }
      if ((rc.metaTs || 0) > (lc.metaTs || 0)) for (const k of ['name', 'start', 'length', 'targetRank', 'weekNotes', 'metaTs']) lc[k] = clone(rc[k]);
      const rts = rc.ts || {};
      const dates = new Set([...Object.keys(rc.entries || {}), ...Object.keys(rts)]);
      for (const d of dates) {
        const lt = lc.ts[d] || 0, rt = rts[d] || 0;
        if (rt > lt || (rt === lt && !lc.entries[d] && rc.entries?.[d])) {
          if (rc.entries?.[d]) lc.entries[d] = clone(rc.entries[d]); else delete lc.entries[d];
          if (rt) lc.ts[d] = rt;
        }
      }
    }
    out.cycles = [...byId.values()].filter((c) => !out.deleted[c.id]);
    // Marketing-Bibliothek: pro Eintrag gewinnt die neuere Fassung
    const mk = new Map((out.marketing || []).map((m) => [m.id, m]));
    for (const rm of remote.marketing || []) { const lm = mk.get(rm.id); if (!lm || (rm.ts || 0) > (lm.ts || 0)) mk.set(rm.id, clone(rm)); }
    out.marketing = [...mk.values()];
    return normalize(out);
  }

  function scheduleSync(delay = 1500) {
    if (!sync) return;
    setSaveState('☁ Wird synchronisiert …');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(runSync, delay);
  }
  async function runSync() {
    if (!sync?.gistId) return;
    if (syncBusy) { syncAgain = true; return; }
    syncBusy = true;
    try {
      const raw = await readGist();
      const remote = raw ? normalize(migrate(raw)) : null;
      const merged = remote ? mergeStates(state, remote) : normalize(clone(state));
      const mergedStr = JSON.stringify(merged);
      if (mergedStr !== JSON.stringify(state)) {
        state = merged;
        if (lsSet(STORE_KEY, mergedStr)) lsSet(BACKUP_KEY, mergedStr);
        if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#app input, #app textarea')) pendingRender = true;
        else render();
      }
      if (!remote || mergedStr !== JSON.stringify(remote)) await writeGist(merged);
      lastSync = new Date();
      setSaveState('☁ Synchronisiert');
    } catch (e) {
      setSaveState(e.status === 401 ? '⚠ Sync: Token ungültig' : '⚠ Offline – wird nachgeholt');
    } finally {
      syncBusy = false;
      if (syncAgain) { syncAgain = false; runSync(); }
    }
  }
  async function connectSync(token) {
    sync = { token: token.trim() };
    try {
      const u = await gh('/user');
      sync.user = u.login;
      let id = await findGist();
      if (!id) {
        const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'Accountability – Daten (automatisch, nicht löschen)', public: false, files: { [GIST_FILE]: { content: JSON.stringify(state) } } }) });
        id = g.id;
      }
      sync.gistId = id;
      lsSet(SYNC_KEY, JSON.stringify(sync));
      await runSync();
      toast('Synchronisierung aktiv');
    } catch (e) {
      sync = null;
      toast(e.status === 401 ? 'Token ungültig' : e.status === 403 || e.status === 404 ? 'Token braucht die Berechtigung „gist“' : 'Verbindung fehlgeschlagen');
    }
    render();
  }
  function disconnectSync() {
    sync = null;
    try { localStorage.removeItem(SYNC_KEY); } catch { /* egal */ }
    setSaveState('✓ Gespeichert'); render(); toast('Sync auf diesem Gerät getrennt');
  }

  const cycleEnd = (c) => addDays(c.start, c.length - 1);
  const cycleDates = (c) => Array.from({ length: c.length }, (_, i) => addDays(c.start, i));
  const cycleFor = (date) => state.cycles.find((c) => date >= c.start && date <= cycleEnd(c));
  const weeksOf = (c) => Math.max(1, Math.ceil(c.length / 7));
  const weekIdx = (c, date) => Math.floor(diffDays(c.start, date) / 7);
  const weekRange = (c, w) => `${fmtShort(addDays(c.start, w * 7))}–${fmtShort(addDays(c.start, Math.min(c.length - 1, w * 7 + 6)))}`;
  const getVal = (c, date, key) => c.entries[date]?.[key];
  const numVal = (c, date, key) => { const v = getVal(c, date, key); return typeof v === 'number' ? v : 0; };
  function sumRange(c, keys, from, to) {
    let s = 0;
    for (let i = Math.max(0, from); i <= to && i < c.length; i++) for (const k of keys) s += numVal(c, addDays(c.start, i), k);
    return s;
  }
  const weekSum = (c, keys, w) => sumRange(c, keys, w * 7, w * 7 + 6);
  const cycleSum = (c, keys) => sumRange(c, keys, 0, c.length - 1);
  const shortName = (c) => { const m = c.name.match(/Cycle\s*(\d+)/i); return m ? `C${m[1]}` : c.name.split(/[\s(]/)[0]; };
  normalize();

  function setValue(c, date, key, v) {
    const e = c.entries[date] || (c.entries[date] = {});
    if (v === null || v === undefined || v === '') delete e[key]; else e[key] = v;
    if (!Object.keys(e).length) delete c.entries[date];
    (c.ts || (c.ts = {}))[date] = Date.now();
    save();
  }

  /* ================= Persönlichkeitsentwicklung ================= */
  // Pro Tag: entries[date].pd = [{ title, note }]; ältere Einträge: entries[date].pd_text (Text oder 1)
  // "Buchtitel: 61-65" / "Buchtitel 134-144" / "Buch: Chapter 1" -> { title, note }
  function splitPd(txt) {
    txt = String(txt || '').trim();
    const m = txt.match(/^(.*?)[\s:,]*((?:s\.|seiten?|kapitel|chapter)\s*\d.*|\d+\s*[-–]\s*(?:\d+|ende|end|schluss))\s*$/i);
    if (m && m[1]) return { title: m[1].replace(/[:\s]+$/, ''), note: m[2].trim() };
    const i = txt.indexOf(':');
    if (i > 0 && txt.slice(i + 1).trim()) return { title: txt.slice(0, i).trim(), note: txt.slice(i + 1).trim() };
    return { title: txt, note: '' };
  }
  const pdItems = (c, date) => { const v = getVal(c, date, 'pd'); return Array.isArray(v) ? v : []; };
  const pdLegacy = (c, date) => { const v = getVal(c, date, 'pd_text'); return typeof v === 'string' ? v.trim() : v ? '✓' : ''; };
  const pdLine = (it) => `${it.title}${it.note ? `: ${it.note}` : ''}`;
  function pdSummary(c, date) {
    const parts = pdItems(c, date).map(pdLine), leg = pdLegacy(c, date);
    if (leg) parts.unshift(leg);
    return parts.join(' | ');
  }
  // Alles, was du schon mal eingetragen hast – zuletzt benutzt zuerst
  // Ähnliche Titel gelten als dasselbe Buch: Tippfehler ("Advanvement") und Kurzformen
  // ("Your Rank Advancement" ⊂ "Your Rank Advancement Blueprint")
  const normTitle = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
  function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function similarTitle(a, b) {
    if (a === b) return true;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a];
    if (s.length >= 6 && l.startsWith(s)) return true;
    return s.length >= 5 && l.length - s.length <= 3 && lev(s, l) <= Math.max(1, Math.floor(s.length * 0.12));
  }
  let libCache = null, libCacheKey = '';
  function pdLibrary() {
    const key = JSON.stringify(state.cycles.map((c) => c.ts));
    if (libCache && key === libCacheKey) return libCache;
    const raw = new Map(); // normalisierter Titel -> Varianten
    const add = (type, title, date) => {
      title = String(title || '').trim(); if (!title || title === '✓') return;
      const k = normTitle(title); if (!k) return;
      const cur = raw.get(k) || { k, n: 0, last: '', type: 'other', spell: new Map() };
      cur.n++; if (date > cur.last) cur.last = date;
      if (type && type !== 'other') cur.type = type;
      cur.spell.set(title, (cur.spell.get(title) || 0) + 1);
      raw.set(k, cur);
    };
    for (const c of state.cycles) for (const [d, e] of Object.entries(c.entries)) {
      if (Array.isArray(e.pd)) for (const it of e.pd) add(it.type, it.title, d);
      if (typeof e.pd_text === 'string') {
        // "Buchtitel: 61-65" / "Buchtitel 134-144" / "Buch: Chapter 1" -> Titel + Seiten
        add('book', splitPd(e.pd_text).title, d);
      }
    }
    // Gruppieren (Union-Find über alle ähnlichen Titel)
    const vs = [...raw.values()], parent = vs.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) if (similarTitle(vs[i].k, vs[j].k)) parent[find(i)] = find(j);
    const groups = new Map();
    vs.forEach((v, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(v); });
    const best = (list) => list.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.k.length > a.k.length) ? b : a));
    const lib = [...groups.values()].map((g) => {
      // häufigste Schreibweise; eine längere, oft genutzte Fassung (z. B. mit "Blueprint") gewinnt
      let main = best(g), ext;
      while ((ext = g.filter((v) => v.k !== main.k && v.k.startsWith(main.k) && v.n >= main.n * 0.3)).length) main = best(ext);
      const title = [...main.spell.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      return { title, type: g.some((v) => v.type === 'book') ? 'book' : best(g).type, last: g.reduce((m, v) => (v.last > m ? v.last : m), ''), n: g.reduce((s, v) => s + v.n, 0), keys: g.map((v) => v.k) };
    });
    libCache = lib.sort((a, b) => b.last.localeCompare(a.last) || b.n - a.n);
    libCacheKey = key;
    return libCache;
  }
  // Eingetippten Titel auf das schon bekannte Buch abbilden (gleiche Schreibweise wie bisher)
  function canonTitle(title) {
    const k = normTitle(title);
    const hit = pdLibrary().find((x) => x.keys.some((y) => similarTitle(k, y)));
    return hit ? hit.title : title;
  }

  /* ================= Rank-Plan ================= */
  function planFor(rankName) {
    const r = rankByName(rankName); if (!r) return null;
    const s = state.settings, rt = s.rates;
    const total = r.leg * 2;
    const need = Math.max(0, total - (s.baseBV || 0));
    const bv = Math.ceil(need / PLAN_WEEKS / 50) * 50;
    const div = (a, p) => (p > 0 ? Math.ceil(a / (p / 100) - 1e-9) : 0);
    const starter = rt.bvPerStarter > 0 ? Math.ceil(bv / rt.bvPerStarter - 1e-9) : 0;
    const closings = div(starter, rt.starterPerClosing);
    const praesis = div(closings, rt.closingPerPraesi);
    const fcs = div(praesis, rt.praesiPerFc);
    const nummern = div(fcs, rt.fcPerNummer);
    return { rank: r, total, need, week: { bv, starter, closings, praesis, fcs, nummern } };
  }

  // BV-Ziel einer Woche: was im Cycle noch fehlt, gleichmäßig auf die verbleibenden Wochen verteilt.
  // Woche 1 = Gesamt-BV / 4; was in einer Woche fehlt, wandert automatisch in die folgenden Wochen.
  function weekBVGoal(c, w, plan) {
    if (!plan) return null;
    // Vergangene Wochen behalten ihr damaliges Ziel; aktuelle + kommende Wochen teilen sich den Rest gleichmäßig.
    const today = todayISO(), n = weeksOf(c);
    const curW = today < c.start ? 0 : diffDays(c.start, today) >= c.length ? n : weekIdx(c, today);
    const from = Math.min(w, curW);
    let before = 0;
    for (let i = 0; i < from; i++) before += weekSum(c, ['quali_volume'], i);
    const left = Math.max(1, n - from);
    return Math.max(0, Math.ceil((plan.need - before) / left - 1e-9));
  }
  const userGoal = (id) => { const v = state.settings.goals[id]; return v > 0 ? v : null; };

  /* ================= Status ================= */
  // Tages-Accountability als Text zum Kopieren (Grundliste immer, Extras nur wenn eingetragen)
  function accountabilityText(c, date) {
    const v = (k) => { const n = numVal(c, date, k); return n ? String(n).replace('.', ',') : ''; };
    const d = parse(date);
    const lines = [
      `Accountability ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}:`,
      `TT gepostet: ${v('tiktok_gepostet')}`,
      `TT liker: ${v('tiktok_liker')}`,
      `TT KA: ${v('tiktok_ka')}`,
      `TT/IG Neue Follower: ${v('tiktok_neue_follower')}`,
      `IG Testreels: ${v('instagram_testreels')}`,
      `IG akquise: ${v('instagram_testreelliker')}`,
      `IG Story: ${v('instagram_stories')}`,
      `Numbers: ${v('sales_nummern')}`,
      `FC: ${v('sales_fcs')}`,
      `Präsis: ${v('sales_praesis')}`,
      `Closings: ${v('sales_closing')}`,
      `Starter: ${v('quali_starter')}`,
      `Volume: ${v('quali_volume')}`,
      `Neins: ${v('sales_neins')}`,
      `Checkups: ${v('pro_cycle_checkups')}`,
    ];
    const extras = [['instagram_sprechstories', 'Sprechstory'], ['tiktok_sprechtiktoks', 'Sprech-TikTok'], ['sales_fu_closing', 'FU Closings'],
      ['pro_cycle_followups', 'Kontakte nachgefasst'], ['pro_cycle_offline_meetings', 'Offline Meeting'], ['team_closing', 'Team Closings'], ['team_starter', 'Team Starter']];
    for (const [k, l] of extras) if (numVal(c, date, k)) lines.push(k === 'pro_cycle_followups' ? 'Alle Kontakte nachgefasst: ✅' : `${l}: ${v(k)}`);
    lines.push(`Persönlichkeitsentwicklung: ${todoValue(c, date, DAILY_TODOS[4]) ? '✅' : ''}`);
    return lines.join('\n');
  }
  function ratioStatus(v, goal) {
    const r = goal > 0 ? v / goal : 0;
    if (r >= 1) return 'done';
    if (r >= 0.66) return 'nearly';
    if (r > 0) return 'onway';
    return 'missing';
  }
  function todoValue(c, date, todo) {
    if (todo.text) return pdItems(c, date).length || pdLegacy(c, date) ? 1 : 0;
    return todo.keys.reduce((s, k) => s + numVal(c, date, k), 0);
  }
  function todoStatus(c, date, todo) {
    const v = todoValue(c, date, todo), g = state.settings.goals[todo.id];
    if (date > todayISO()) return v ? ratioStatus(v, g) : 'future';
    return ratioStatus(v, g);
  }
  function chip(st) {
    const s = STATUS[st];
    return s ? `<span class="chip st-${st}"><span aria-hidden="true">${s.icon}</span>${s.label}</span>` : '';
  }
  function dayScore(c, date) {
    const done = DAILY_TODOS.filter((t) => todoValue(c, date, t) >= state.settings.goals[t.id]).length;
    return { done, total: DAILY_TODOS.length, pct: Math.round((done / DAILY_TODOS.length) * 100) };
  }
  // Serie = aufeinanderfolgende Tage, an denen ALLE täglichen ToDos erledigt wurden.
  // Heute zählt mit, sobald alles erledigt ist; sonst endet die Serie gestern.
  function streak() {
    const full = (x) => { const c = cycleFor(x); return !!c && dayScore(c, x).done === DAILY_TODOS.length; };
    let d = todayISO(), n = 0;
    if (!full(d)) d = addDays(d, -1);
    while (full(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  /* ================= UI ================= */
  const VIEWS = ['today', 'cycle', 'marketing', 'settings'];
  const pickView = (v) => (VIEWS.includes(v) ? v : 'today');
  const ui = {
    view: 'today', // Startseite ist immer „Heute“
    date: todayISO(),
    cycleId: null,
    mkCat: lsGet('acc.mkCat') || 'start',
    mkQuery: '',
    mkEdit: null, // null | 'new' | id
    mkDraft: null,
    mkOpen: new Set(),
  };
  const selectedCycle = () => state.cycles.find((c) => c.id === ui.cycleId) || cycleFor(todayISO()) || state.cycles[state.cycles.length - 1];
  const app = $('#app');

  function render() {
    $$('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === ui.view));
    hideTip();
    ({ today: renderToday, cycle: renderCycle, marketing: renderMarketing, settings: renderGoals })[ui.view]();
  }
  function setView(v) { ui.view = pickView(v); lsSet('acc.view', ui.view); history.replaceState(null, '', `#${ui.view}`); render(); window.scrollTo({ top: 0 }); }

  function cycleSelect(c) {
    return `<select class="input" data-action="pick-cycle" aria-label="Cycle auswählen">
      ${[...state.cycles].reverse().map((x) => `<option value="${x.id}" ${x === c ? 'selected' : ''}>${esc(x.name)} · ${fmtShort(x.start)}–${fmtShort(cycleEnd(x))}</option>`).join('')}
    </select>`;
  }
  function noCycleCard(date) {
    if (!state.cycles.length && !sync) {
      return `<div class="card empty">
        <h2>Noch keine Daten auf diesem Gerät</h2>
        <p>Schon auf einem anderen Gerät eingetragen? Dann zuerst verbinden.</p>
        <div class="row wrap" style="justify-content:center">
          <button class="btn primary" data-action="go-settings">☁ Synchronisierung einrichten</button>
          <button class="btn" data-action="new-cycle" data-start="${date || ''}">＋ Neu starten</button>
          ${importBtn()}
        </div>
      </div>`;
    }
    return `<div class="card empty">
      <h2>Für ${date ? esc(fmtLong(date)) : 'diesen Zeitraum'} gibt es noch keinen Cycle</h2>
      <button class="btn primary" data-action="new-cycle" data-start="${date || ''}">＋ Neuen Cycle starten</button>
    </div>`;
  }
  function stepper(key, v, label) {
    const m = M[key];
    return `<div class="stepper ${m.wide ? 'wide' : ''}">
      <button data-action="step" data-key="${key}" data-delta="-1" aria-label="${esc(label)} minus 1">−</button>
      <input inputmode="decimal" autocomplete="off" data-key="${key}" value="${v ?? ''}" placeholder="0" aria-label="${esc(label)}">
      <button data-action="step" data-key="${key}" data-delta="1" aria-label="${esc(label)} plus 1">+</button>
    </div>`;
  }
  function progRow(label, v, goal) {
    const pct = goal > 0 ? Math.min(100, (v / goal) * 100) : 0;
    const ok = goal > 0 && v >= goal;
    return `<div class="prog">
      <span class="name">${label}</span>
      <span class="nums"><b>${fmt(v)}</b> / ${fmt(goal)}${ok ? ' ✓' : ''}</span>
      <div class="bar ${ok ? 'done' : ''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    </div>`;
  }

  /* ================= HEUTE ================= */
  function renderToday() {
    const date = ui.date, c = cycleFor(date), isToday = date === todayISO();
    const head = `<div class="page-head has-copy">
      ${c ? '<button class="acc-copy" data-action="copy-acc" aria-label="Accountability kopieren" title="Accountability kopieren"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>' : ''}
      <div class="head-line">
        <h1>${isToday ? 'Heute' : esc(fmtLong(date))}</h1>
        ${c ? `<div class="sub">Woche ${weekIdx(c, date) + 1} · Tag ${diffDays(c.start, date) + 1}/${c.length}</div>
        <div class="mini-score" id="miniScore">${miniScore(c, date)}</div>` : ''}
      </div>
      <div class="datenav">
        <button class="btn ghost sm" data-action="day" data-delta="-1" aria-label="Vorheriger Tag">‹</button>
        <label class="datepick"><span class="label">${esc(fmtDay(date))}<span class="cal" aria-hidden="true">▾</span></span>
          <input type="date" value="${date}" data-action="pick-date" aria-label="Datum wählen"></label>
        <button class="btn ghost sm" data-action="day" data-delta="1" aria-label="Nächster Tag">›</button>
        ${isToday ? '' : '<button class="btn sm" data-action="go-today">Heute</button>'}
      </div>
    </div>`;
    if (!c) { app.innerHTML = head + noCycleCard(date); return; }
    app.innerHTML = `${head}
      <div class="grid-today">
        <div class="stack">${todayMain(c, date)}</div>
        <aside class="side" id="side">${sidePanel(c, date)}</aside>
      </div>`;
  }

  // Alle Zähler "x/Ziel" an einer Stelle berechnet (für Rendern und Aktualisieren)
  function counts(c, date) {
    const g = state.settings.goals, w = weekIdx(c, date), plan = planFor(c.targetRank), out = {};
    for (const t of DAILY_TODOS) out[t.id] = [todoValue(c, date, t), g[t.id]];
    for (const t of WEEKLY_TODOS) out[t.id] = [weekSum(c, t.keys, w), g[t.id]];
    for (const t of CYCLE_TODOS) out[t.id] = [cycleSum(c, t.keys), g[t.id]];
    out.checkups = [cycleSum(c, ['pro_cycle_checkups']), null];
    for (const m of METRICS.filter((x) => x.section === 'outcome' || x.section === 'team')) {
      out[m.key] = [weekSum(c, [m.key], w), m.key === 'quali_volume' ? weekBVGoal(c, w, plan) : m.key === 'sales_closing' ? userGoal('closingsWeek') : m.key === 'quali_starter' ? userGoal('starterWeek') : null];
    }
    return out;
  }
  function cntHTML([v, goal]) {
    return goal == null ? `${fmt(v)}` : `${fmt(v)}<span>/${fmt(goal)}</span>`;
  }
  function cntSpan(id, cs) {
    const [v, goal] = cs[id];
    return `<span class="cnt ${goal != null && v >= goal ? 'ok' : ''}" data-cnt="${id}">${cntHTML(cs[id])}</span>`;
  }

  // Häufige BV-Beträge zum Antippen (werden zum Tageswert addiert); anderer Betrag direkt ins Feld
  const BV_AMOUNTS = [250, 220, 1025];
  function todayMain(c, date) {
    const cs = counts(c, date);
    const row = (label, cntId, inner) => `<div class="trow"><span class="tlabel">${esc(label)}</span>${cntId ? cntSpan(cntId, cs) : '<span></span>'}${inner}</div>`;
    const step = (key, label) => stepper(key, getVal(c, date, key), label);
    const [cv, cg] = cs.contacts;
    const SHORT = { tiktok_ka: 'Kaltakquise TikTok', tiktok_liker: 'Liker TikTok', tiktok_neue_follower: 'Neue Follower', instagram_testreelliker: 'Liker Instagram' };

    const daily = `<section class="card todo-card">
      <div class="card-head"><h2>Täglich</h2></div>
      ${row('TikToks gepostet', 'tiktok', step('tiktok_gepostet', 'TikToks gepostet'))}
      <div class="trow contacts-row"><span class="tlabel">Kontakte angeschrieben</span>${cntSpan('contacts', cs)}<span></span></div>
      <div class="bar thin ${cv >= cg ? 'done' : ''}" data-bar="contacts"><span style="width:${Math.min(100, (cv / cg) * 100)}%"></span></div>
      <div class="subrows">${CONTACT_KEYS.map((k) => `<div class="subrow"><span>${SHORT[k]}</span>${step(k, SHORT[k])}</div>`).join('')}</div>
      ${row('Testreel', 'testreel', step('instagram_testreels', 'Testreel'))}
      ${row('Story', 'story', step('instagram_stories', 'Story'))}
      <div class="trow pd-row"><span class="tlabel">Persönlichkeitsentwicklung</span>${cntSpan('pd', cs)}<span></span></div>
      <div id="pdBox" class="pd-box">${pdBox(c, date)}</div>
    </section>`;

    const weekly = `<section class="card">
      <div class="card-head"><h2>Woche</h2></div>
      ${WEEKLY_TODOS.map((t) => row(t.label, t.id, step(t.keys[0], t.label))).join('')}
    </section>`;

    const cyc = `<section class="card">
      <div class="card-head"><h2>Cycle</h2></div>
      ${(() => { const on = cycleSum(c, ['pro_cycle_followups']) > 0;
        return row('Alle Kontakte nachgefasst', null, `<button type="button" class="check ${on ? 'on' : ''}" data-action="fu-toggle" role="checkbox" aria-checked="${on}" aria-label="Alle Kontakte nachgefasst">✓</button>`); })()}
      ${row('Offline Meeting', 'offline', step('pro_cycle_offline_meetings', 'Offline Meeting'))}
      ${row('Checkups', 'checkups', step('pro_cycle_checkups', 'Checkups'))}
    </section>`;

    const outcome = `<section class="card">
      <div class="card-head"><h2>Outcome</h2></div>
      <div class="two-col">${METRICS.filter((m) => (m.section === 'outcome' || m.section === 'team') && m.key !== 'quali_volume').map((m) => row(m.section === 'team' ? m.short : m.label, null, step(m.key, m.label))).join('')}
        <div class="trow bv-row"><span class="tlabel">Volumen (BV)</span>
          <div class="bv-box">
            <input class="bv-input" inputmode="decimal" autocomplete="off" data-key="quali_volume" value="${getVal(c, date, 'quali_volume') ?? ''}" placeholder="Betrag" aria-label="Volumen (BV)">
            ${BV_AMOUNTS.map((n) => `<button type="button" class="bv-chip" data-action="bv-add" data-v="${n}">+${fmt(n)}</button>`).join('')}
          </div>
        </div>
      </div>
    </section>`;

    return (parse(date).getDay() === 0 ? weeklyReportCard(date) : '') + daily + `<div class="groups">${weekly}${cyc}</div>` + outcome;
  }

  function pdBox(c, date) {
    const items = pdItems(c, date), leg = pdLegacy(c, date);
    const li = (title, note, del) => `<li class="pd-item">
        <span class="pd-ico" aria-hidden="true">📖</span>
        <span class="pd-txt"><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span>
        <button type="button" class="pd-del" ${del} aria-label="${esc(title)} entfernen">×</button></li>`;
    const list = [
      leg ? li(leg === '✓' ? 'Erledigt (ohne Details)' : splitPd(leg).title, leg === '✓' ? '' : splitPd(leg).note, 'data-action="pd-del-legacy"') : '',
      ...items.map((it, i) => li(it.title, it.note, `data-action="pd-del" data-i="${i}"`)),
    ].join('');
    return `${list ? `<ul class="pd-list">${list}</ul>` : ''}
      <div class="pd-form">
        <div class="pd-chips" id="pdChips">${pdChips(c, date, '')}</div>
        <div class="pd-add">
          <input class="input" id="pdTitle" type="search" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="Was hast du gelesen?" aria-label="Was hast du gelesen oder gehört?">
          <button type="button" class="btn primary" data-action="pd-add">＋ Eintragen</button>
        </div>
      </div>`;
  }
  // Vorschläge: alle bisherigen Bücher, beim Tippen gefiltert (wie eine Suche)
  function pdChips(c, date, query) {
    const todays = pdItems(c, date).map((i) => normTitle(i.title));
    const q = normTitle(splitPd(query).title || query);
    let list = pdLibrary().filter((x) => !todays.some((t) => x.keys.some((y) => similarTitle(t, y))));
    if (q) {
      const score = (x) => {
        const k = normTitle(x.title);
        if (k.startsWith(q) || x.keys.some((y) => y.startsWith(q))) return 3;
        if (x.title.toLowerCase().split(/\s+/).some((w) => normTitle(w).startsWith(q))) return 2;
        if (x.keys.some((y) => y.includes(q))) return 1;
        return q.length >= 4 && x.keys.some((y) => similarTitle(q, y.slice(0, q.length))) ? 1 : 0;
      };
      list = list.map((x) => [x, score(x)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x);
    }
    if (!list.length) return q ? '<span class="pd-none">Neues Buch – einfach eintragen</span>' : '';
    return list.map((x) => `<button type="button" class="pd-chip" data-action="pd-pick" data-title="${esc(x.title)}"><span class="t">${esc(x.title)}</span></button>`).join('');
  }
  function pdAdd(c, date) {
    const ti = $('#pdTitle');
    const raw = splitPd(ti.value);
    if (!raw.title) { ti.focus(); toast('Bitte eintragen, was du gelesen / gehört hast'); return; }
    const title = canonTitle(raw.title);
    const items = [...pdItems(c, date), { title, ...(raw.note ? { note: raw.note } : {}) }];
    document.activeElement?.blur?.();
    setValue(c, date, 'pd', items);
    $('#pdBox').innerHTML = pdBox(c, date);
    refreshToday(c, date);
    toast('Persönlichkeitsentwicklung ✓');
  }

  // Wochentext (Mo–So, endet am gewählten Sonntag; über Cycle-Grenzen hinweg)
  function weekReport(sunday) {
    let closings = 0, starter = 0;
    for (let i = 6; i >= 0; i--) {
      const d = addDays(sunday, -i), c = cycleFor(d);
      if (c) { closings += numVal(c, d, 'sales_closing'); starter += numVal(c, d, 'quali_starter'); }
    }
    return `Leuten das Business gezeigt: ${fmt(closings)}\nStarter: ${fmt(starter)}`;
  }
  function weeklyReportCard(sunday) {
    return `<section class="card report-card">
      <div class="card-head"><h2>Wochenabschluss</h2><button class="btn sm primary" data-action="copy-report">⧉ Kopieren</button></div>
      <pre class="report" id="reportText">${esc(weekReport(sunday))}</pre>
    </section>`;
  }

  function sidePanel(c, date) {
    const sc = dayScore(c, date), R = 42, C = 2 * Math.PI * R, s = streak();
    const plan = planFor(c.targetRank), bv = cycleSum(c, ['quali_volume']);
    return `
      <section class="card score-card">
        <div class="ring" role="img" aria-label="${sc.done} von ${sc.total} ToDos erledigt">
          <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${R}" fill="none" stroke-width="10"/>
            <circle class="val" cx="50" cy="50" r="${R}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - sc.pct / 100)}"/></svg>
          <div class="pct">${sc.done}/${sc.total}</div>
        </div>
        ${s > 0 ? `<div class="flame" title="${s} ${s === 1 ? 'Tag' : 'Tage'} in Folge alle ToDos">🔥 ${s}</div>` : ''}
      </section>
      ${plan ? `<section class="card">
        <div class="card-head"><h3>${esc(plan.rank.name)}</h3></div>
        ${progRow('BV im Cycle', bv, plan.need)}
      </section>` : ''}`;
  }
  function miniScore(c, date) {
    const sc = dayScore(c, date), s = streak();
    return `<span>${sc.done}/${sc.total}</span><div class="bar ${sc.pct >= 100 ? 'done' : ''}"><span style="width:${sc.pct}%"></span></div>${s > 0 ? `<span>🔥 ${s}</span>` : ''}`;
  }
  function refreshToday(c, date) {
    // Zähler und Seitenleiste aktualisieren, ohne Eingabefelder neu zu zeichnen
    const cs = counts(c, date);
    $$('[data-cnt]', app).forEach((el) => {
      const [v, goal] = cs[el.dataset.cnt];
      el.innerHTML = cntHTML(cs[el.dataset.cnt]);
      el.classList.toggle('ok', goal != null && v >= goal);
    });
    const [cv, cg] = cs.contacts;
    const bar = $('[data-bar="contacts"]', app); if (bar) { bar.classList.toggle('done', cv >= cg); bar.firstElementChild.style.width = `${Math.min(100, (cv / cg) * 100)}%`; }
    $('#side').innerHTML = sidePanel(c, date);
    const ms = $('#miniScore'); if (ms) ms.innerHTML = miniScore(c, date);
    const rt = $('#reportText'); if (rt) rt.textContent = weekReport(date);
  }


  /* ================= CYCLE ================= */
  const SHEET_SECTIONS = [
    { title: 'Tägliche ToDos', cols: ['tiktok_gepostet', ...CONTACT_KEYS, '__contacts', 'instagram_testreels', 'instagram_stories', 'pd_text'] },
    { title: 'Wöchentlich', cols: ['instagram_sprechstories', 'tiktok_sprechtiktoks'] },
    { title: 'Outcome', cols: METRICS.filter((m) => m.section === 'outcome').map((m) => m.key) },
    { title: 'Team', cols: ['team_closing', 'team_starter'] },
    { title: 'Pro Cycle', cols: ['pro_cycle_followups', 'pro_cycle_offline_meetings', 'pro_cycle_checkups'] },
  ];
  const TODO_BY_KEY = { tiktok_gepostet: DAILY_TODOS[0], __contacts: DAILY_TODOS[1], instagram_testreels: DAILY_TODOS[2], instagram_stories: DAILY_TODOS[3], pd_text: DAILY_TODOS[4] };

  function renderCycle() {
    const c = selectedCycle();
    if (!c) { app.innerHTML = noCycleCard(); return; }
    app.innerHTML = `
      <div class="page-head">
        <div class="head-line"><h1>${esc(c.name)}</h1><div class="sub">${esc(fmtCycle(c.start))} – ${esc(fmtCycle(cycleEnd(c)))}</div>${c.targetRank ? `<div class="sub" style="flex-basis:100%">Ziel: <strong>${esc(c.targetRank)}</strong></div>` : ''}</div>
      </div>
      <div id="cycleSummary">${cycleSummary(c)}</div>`;
  }

  function cycleSummary(c) {
    const today = todayISO(), g = state.settings.goals, plan = planFor(c.targetRank);
    const tile = (label, v, goal, extra = '') => `<div class="card kpi"><div class="k-label">${label}</div>
      <div class="k-val">${fmt(v)} <small>/ ${fmt(goal)}${extra}</small></div>
      <div class="bar ${v >= goal ? 'done' : ''}"><span style="width:${goal > 0 ? Math.min(100, (v / goal) * 100) : 0}%"></span></div></div>`;
    const past = cycleDates(c).filter((d) => d <= today);
    const avg = past.length ? Math.round(past.reduce((s, d) => s + dayScore(c, d).pct, 0) / past.length) : 0;
    const kpis = [
      plan ? tile(`BV für ${esc(plan.rank.name)}`, cycleSum(c, ['quali_volume']), plan.need, ' BV') : '',
      `<div class="card kpi"><div class="k-label">Ø tägliche ToDos erledigt</div><div class="k-val">${avg}<small> %</small></div><div class="bar"><span style="width:${avg}%"></span></div></div>`,
    ].join('');
    const curW = cycleFor(today) === c ? weekIdx(c, today) : -1;
    const weeks = Array.from({ length: weeksOf(c) }, (_, w) => weekCard(c, w, w === curW, plan)).join('');
    return `<div class="kpis">${kpis}</div><div class="weeks">${weeks}</div>`;
  }

  // Kompakte Wochen-Zusammenfassung: Tage-Leiste, Wochen-ToDos, Haupt-Outcome, Rest in einer Zeile
  function weekCard(c, w, current, plan) {
    const g = state.settings.goals, today = todayISO();
    const days = Array.from({ length: 7 }, (_, i) => addDays(c.start, w * 7 + i)).filter((d) => diffDays(c.start, d) < c.length);
    let full = 0;
    const strip = days.map((d) => {
      const sc = dayScore(c, d);
      if (sc.done === sc.total) full++;
      const st = d > today ? 'future' : sc.done === sc.total ? 'done' : sc.pct >= 60 ? 'nearly' : sc.done > 0 ? 'onway' : 'missing';
      return `<span class="dcell st-${st}" title="${esc(fmtDay(d))}: ${sc.done}/${sc.total} ToDos">${WD[parse(d).getDay()].charAt(0)}</span>`;
    }).join('');
    const todos = WEEKLY_TODOS.map((t) => {
      const v = weekSum(c, t.keys, w), ok = v >= g[t.id];
      return `<span class="wtodo ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${esc(t.label)} <b>${fmt(v)}/${fmt(g[t.id])}</b></span>`;
    }).join('');
    const main = [['sales_closing', userGoal('closingsWeek'), 'Closings'], ['quali_starter', userGoal('starterWeek'), 'Starter'], ['quali_volume', weekBVGoal(c, w, plan), 'BV']]
      .map(([k, goal, l]) => (goal != null ? progRow(l, weekSum(c, [k], w), goal) : `<div class="prog"><span class="name">${l}</span><span class="nums"><b>${fmt(weekSum(c, [k], w))}</b></span></div>`)).join('');
    const small = [['sales_nummern', 'Nummern'], ['sales_fcs', 'First Calls'], ['sales_praesis', 'Präsis']]
      .map(([k, l]) => `<span>${l} <b>${fmt(weekSum(c, [k], w))}</b></span>`).join('');
    const tc = weekSum(c, ['team_closing'], w), ts = weekSum(c, ['team_starter'], w);
    return `<section class="card week ${current ? 'current' : ''}">
      <div class="card-head"><h2>Woche ${w + 1}</h2><span class="muted small">${weekRange(c, w)}${current ? ' · <span class="pill">aktuell</span>' : ''}</span></div>
      <div class="daystrip">${strip}</div>
      <div class="muted small" style="margin:6px 0 10px">${full} von ${days.length} Tagen alle ToDos erledigt</div>
      <div class="wtodos">${todos}</div>
      <div class="mini-stats top">${small}</div>
      ${main}
      ${tc || ts ? `<div class="muted small" style="margin-top:6px">Team: <b>${fmt(tc)}</b> Closings · <b>${fmt(ts)}</b> Starter</div>` : ''}
    </section>`;
  }

  function colLabel(k) { return k === '__contacts' ? 'Kontakte Σ' : (M[k].short || M[k].label); }

  const elapsedDays = (c) => { const t = todayISO(); return t < c.start ? 0 : Math.min(c.length, diffDays(c.start, t) + 1); };

  /* ================= MARKETING ================= */
  // Bibliothek für Texte, Hooks, Ideen und Inspo – state.marketing = [{ id, cat, title, text, url, fav, created, ts }]
  const MK_CATS = {
    start: { label: 'Erstnachricht', icon: '👋', hint: 'Erste DM auf TikTok / Insta' },
    reply: { label: 'Antworten', icon: '💬', hint: 'Wenn sie zurückschreibt' },
    wa: { label: 'WhatsApp', icon: '📱', hint: 'Nummer, Video, Call ausmachen' },
    obj: { label: 'Einwände', icon: '🛡️', hint: 'Bedanken – Ergründen – Lösung' },
    content: { label: 'Content', icon: '💡', hint: 'Hooks, Ideen, Inspo' },
  };
  const MK_LEGACY = { dm: 'reply', hook: 'content', idea: 'content', inspo: 'content' };
  const mkCatOf = (m) => (MK_CATS[m.cat] ? m.cat : MK_LEGACY[m.cat] || 'content');
  const MK_GUIDE = `<details class="card mk-guide">
      <summary><b>Leitfaden Einwandbehandlung</b><span class="muted small">antippen</span></summary>
      <p class="mk-goal">Menschen verstehen und souverän durch die Entscheidung führen. Du bist da, um zu <b>helfen</b> – nicht um zu überzeugen.</p>
      <div class="mk-blueprint"><span>1 · Bedanken</span><span>2 · Isolieren / Ergründen</span><span>3 · Lösung</span></div>
      <p class="small"><b>Einwand</b> = Unsicherheit („Ich hab Angst, dass ich es nicht schaffe“) · <b>Vorwand</b> = Schutz („Muss eine Nacht drüber schlafen“). Sag nicht, wie es nicht ist – <b>sag, wie es ist</b>.</p>
      <div class="mk-dd">
        <div><h3>Dos</h3><ul><li>Fragen stellen</li><li>Aktiv zuhören & spiegeln</li><li>Kurz bestätigen („macht Sinn“, „verstehe ich“)</li><li>Klar zum nächsten Schritt führen</li><li>Entscheidungen respektieren</li><li>Selbstbewusst, professionell, authentisch</li></ul></div>
        <div><h3>Don'ts</h3><ul><li>Argumentieren / überzeugen wollen</li><li>Zu lange schreiben statt zum Call</li><li>Emotionale Diskussionen im Chat</li><li>Sofort reagieren ohne zu verstehen</li><li>Kosenamen</li></ul></div>
      </div>
      <p class="small"><b>Wunschtechnik:</b> „Angenommen, du hättest xy gelöst und wärst in 6 Monaten an dem Punkt, wo du xy kannst – wie würdest du dich fühlen?“</p>
      <h3>Persönlichkeitstypen</h3>
      <div class="mk-types">
        <div><b>🦈 Hai</b><span>dominant, zielorientiert, kurz & direkt – „Was bringt mir das?“</span><em>→ Ergebnisse & Testimonials zeigen</em></div>
        <div><b>🦉 Eule</b><span>analytisch, viele Fragen, will Zahlen & Fakten</span><em>→ Sicherheit: System, Schritt für Schritt, messbar</em></div>
        <div><b>🐬 Delfin</b><span>emotional, redet & lacht viel, Spaß & Team</span><em>→ Community, Events, Retreats, Aftermovie</em></div>
        <div><b>🐋 Wal</b><span>hilfsbereit, Werte wichtig, sucht Sinn</span><em>→ Community, Support, Mentorship, anderen helfen</em></div>
      </div>
    </details>`;
  function mkFiltered() {
    const q = ui.mkQuery.trim().toLowerCase();
    return state.marketing
      .filter((m) => ui.mkCat === 'all' || mkCatOf(m) === ui.mkCat)
      .filter((m) => !q || `${m.title} ${m.text} ${m.url}`.toLowerCase().includes(q))
      .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (a.order ? 1 : 0) - (b.order ? 1 : 0) || (a.order || 0) - (b.order || 0) || (b.created || 0) - (a.created || 0));
  }
  function mkEditor() {
    const d = ui.mkDraft || {}, isNew = ui.mkEdit === 'new', cat = MK_CATS[d.cat] ? d.cat : 'start';
    return `<section class="card mk-editor">
      <div class="card-head"><h2>${isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2></div>
      <div class="seg mk-seg" role="radiogroup" aria-label="Kategorie">${Object.entries(MK_CATS).map(([k, v]) => `<button type="button" role="radio" aria-checked="${k === cat}" class="${k === cat ? 'on' : ''}" data-action="mk-draft-cat" data-cat="${k}"><span aria-hidden="true">${v.icon}</span>${v.label.split(' ')[0]}</button>`).join('')}</div>
      <label class="field">Titel<input class="input" data-mk="title" value="${esc(d.title || '')}" placeholder="z. B. Like auf TikTok" autocomplete="off"></label>
      <label class="field">Text<textarea class="input" data-mk="text" rows="6" placeholder="Der Text zum Kopieren …">${esc(d.text || '')}</textarea></label>
      <label class="field">Link (optional)<input class="input" data-mk="url" type="url" inputmode="url" value="${esc(d.url || '')}" placeholder="https://…" autocomplete="off"></label>
      <div class="row wrap mk-editor-actions">
        <button type="button" class="btn primary" data-action="mk-save">✓ Speichern</button>
        <button type="button" class="btn" data-action="mk-cancel">Abbrechen</button>
        ${isNew ? '' : '<button type="button" class="btn ghost danger" data-action="mk-delete">Löschen</button>'}
      </div>
    </section>`;
  }
  function mkCard(m) {
    const cat = MK_CATS[mkCatOf(m)], open = ui.mkOpen.has(m.id), long = (m.text || '').length > 260 || (m.text || '').split('\n').length > 6;
    let host = '';
    try { host = m.url ? new URL(m.url).hostname.replace(/^www\./, '') : ''; } catch { host = m.url; }
    return `<article class="card mk-item ${m.fav ? 'fav' : ''}">
      <div class="mk-head">
        ${ui.mkCat === 'all' ? `<span class="mk-cat"><span aria-hidden="true">${cat.icon}</span>${cat.label}</span>` : `<h3 class="mk-title">${esc(m.title || '')}</h3>`}
        <button type="button" class="mk-star ${m.fav ? 'on' : ''}" data-action="mk-fav" data-id="${m.id}" aria-pressed="${!!m.fav}" aria-label="Favorit">${m.fav ? '★' : '☆'}</button>
      </div>
      ${m.title && ui.mkCat === 'all' ? `<h3 class="mk-title">${esc(m.title)}</h3>` : ''}
      ${m.text ? `<div class="mk-text ${long && !open ? 'clamp' : ''}" data-action="mk-copy" data-id="${m.id}" role="button" tabindex="0" title="Antippen zum Kopieren">${esc(m.text)}</div>${long ? `<button type="button" class="mk-more" data-action="mk-toggle" data-id="${m.id}">${open ? 'Weniger' : 'Ganzen Text zeigen'}</button>` : ''}` : ''}
      <div class="mk-actions">
        ${m.text ? `<button type="button" class="btn primary sm" data-action="mk-copy" data-id="${m.id}">⧉ Kopieren</button>` : ''}
        ${m.url ? `<a class="btn sm" href="${esc(m.url)}" target="_blank" rel="noopener">↗ ${esc(host || 'Link')}</a>` : ''}
        <button type="button" class="btn ghost sm" data-action="mk-edit" data-id="${m.id}">Bearbeiten</button>
      </div>
    </article>`;
  }
  // Content: kompakte Zeile – Text antippen kopiert, ✎ bearbeitet
  const mkRow = (m) => `<li class="mk-row">
      <div class="mk-line" data-action="mk-copy" data-id="${m.id}" role="button" tabindex="0" title="Antippen zum Kopieren">${m.title ? `<b>${esc(m.title)}</b> ` : ''}${esc(m.text || m.url || '')}</div>
      <button type="button" class="mk-mini" data-action="mk-edit" data-id="${m.id}" aria-label="Bearbeiten">✎</button>
    </li>`;
  function mkList() {
    const items = mkFiltered();
    if (!state.marketing.length) {
      return `<div class="card empty mk-empty">
        <h2>Deine Texte</h2>
        <p>Sammle hier alles, was du beim Posten und Anschreiben brauchst – und kopiere es mit einem Tipp.</p>
        <div class="mk-starters">${Object.entries(MK_CATS).map(([k, v]) => `<button type="button" class="mk-starter" data-action="mk-new" data-cat="${k}"><span class="i" aria-hidden="true">${v.icon}</span><b>${v.label}</b><small>${v.hint}</small></button>`).join('')}</div>
      </div>`;
    }
    if (!items.length) return `<div class="card empty"><p>Nichts gefunden.</p></div>`;
    const cards = items.filter((m) => mkCatOf(m) !== 'content'), rows = items.filter((m) => mkCatOf(m) === 'content');
    return `${cards.length ? `<div class="mk-list">${cards.map(mkCard).join('')}</div>` : ''}
      ${rows.length ? `<ul class="card mk-rows">${rows.map(mkRow).join('')}</ul>` : ''}`;
  }
  function renderMarketing() {
    const n = (k) => state.marketing.filter((m) => k === 'all' || mkCatOf(m) === k).length;
    if (!MK_CATS[ui.mkCat]) ui.mkCat = 'start';
    const tabs = Object.entries(MK_CATS).map(([k, v]) => [k, v.label, v.icon]);
    app.innerHTML = `
      <div class="mk-top">
        <div class="mk-top-title"><h1>Texte</h1><div class="sub">Text antippen = kopiert</div></div>
        <input class="mk-search" type="search" data-mk-search value="${esc(ui.mkQuery)}" placeholder="Suchen …" aria-label="Suchen" autocomplete="off">
        ${ui.mkEdit ? '' : '<button class="mk-plus" data-action="mk-new" aria-label="Eigenen Text hinzufügen" title="Eigenen Text hinzufügen">＋</button>'}
      </div>
      ${ui.mkEdit ? mkEditor() : ''}
      ${state.marketing.length ? `<div class="mk-filters">
        <div class="mk-cats" role="tablist">${tabs.map(([k, l, i]) => `<button type="button" role="tab" aria-selected="${ui.mkCat === k}" class="mk-cat-btn ${ui.mkCat === k ? 'on' : ''}" data-action="mk-cat" data-cat="${k}">${i ? `<span aria-hidden="true">${i}</span>` : ''}${l}<small>${n(k)}</small></button>`).join('')}</div>
      </div>` : ''}
      ${ui.mkCat === 'obj' ? MK_GUIDE : ''}
      <div id="mkList">${mkList()}</div>`;    const on = $('.mk-cat-btn.on', app); if (on) on.parentNode.scrollLeft = on.offsetLeft - 16;
  }
  function mkAction(a, el) {
    const byId = (id) => state.marketing.find((m) => m.id === id);
    if (a === 'mk-new') {
      ui.mkEdit = 'new';
      ui.mkDraft = { cat: el.dataset.cat || (MK_CATS[ui.mkCat] ? ui.mkCat : 'start'), title: '', text: '', url: '' };
      render(); window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => $('[data-mk="title"]')?.focus({ preventScroll: true }), 50);
    } else if (a === 'mk-edit') {
      const m = byId(el.dataset.id); if (!m) return;
      ui.mkEdit = m.id; ui.mkDraft = { cat: mkCatOf(m), title: m.title || '', text: m.text || '', url: m.url || '' };
      render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (a === 'mk-draft-cat') {
      ui.mkDraft.cat = el.dataset.cat;
      $$('[data-action="mk-draft-cat"]', app).forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    } else if (a === 'mk-cancel') {
      ui.mkEdit = null; ui.mkDraft = null; render();
    } else if (a === 'mk-save') {
      const d = ui.mkDraft;
      d.title = d.title.trim(); d.text = d.text.replace(/\s+$/, ''); d.url = d.url.trim();
      if (d.url && !/^https?:\/\//i.test(d.url)) d.url = `https://${d.url}`;
      if (!d.title && !d.text && !d.url) { toast('Bitte Titel, Text oder Link eintragen'); return; }
      const now = Date.now();
      if (ui.mkEdit === 'new') state.marketing.push({ id: `m${now}${Math.random().toString(36).slice(2, 6)}`, ...d, fav: false, created: now, ts: now });
      else { const m = byId(ui.mkEdit); if (m) Object.assign(m, d, { ts: now }); }
      ui.mkEdit = null; ui.mkDraft = null; save(); render(); toast('Gespeichert');
    } else if (a === 'mk-delete') {
      const m = byId(ui.mkEdit);
      if (m && confirm(`„${m.title || 'Eintrag'}“ löschen?`)) {
        state.deleted[m.id] = Date.now(); state.marketing = state.marketing.filter((x) => x !== m);
        ui.mkEdit = null; ui.mkDraft = null; save(); render(); toast('Gelöscht');
      }
    } else if (a === 'mk-fav') {
      const m = byId(el.dataset.id); if (!m) return;
      m.fav = !m.fav; m.ts = Date.now(); save(); $('#mkList').innerHTML = mkList();
    } else if (a === 'mk-toggle') {
      const id = el.dataset.id; if (ui.mkOpen.has(id)) ui.mkOpen.delete(id); else ui.mkOpen.add(id);
      $('#mkList').innerHTML = mkList();
    } else if (a === 'mk-copy') {
      const m = byId(el.dataset.id); if (m) copyText(m.text || m.url, 'Kopiert – jetzt einfügen');
    } else if (a === 'mk-cat') {
      ui.mkCat = el.dataset.cat; lsSet('acc.mkCat', ui.mkCat); render();
    }
  }
  function copyText(txt, msg = 'Text kopiert') {
    const done = () => toast(msg);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }

  /* ================= ZIELE ================= */
  function renderGoals() {
    const s = state.settings, g = s.goals;
    const achievedIdx = RANKS.findIndex((r) => r.name === s.achievedRank);
    const target = nextRank(s.achievedRank);
    const c = selectedCycle();
    const goalInput = (id, label, unit, ph = '') => `<label class="field">${label}<div class="row"><input class="input num" inputmode="decimal" data-goal="${id}" value="${g[id] ?? ''}" placeholder="${ph}"><span class="muted small">${unit}</span></div></label>`;
    const curC = cycleFor(todayISO()), curPlan = curC ? planFor(curC.targetRank) : null;
    const bvNow = curC && curPlan ? weekBVGoal(curC, weekIdx(curC, todayISO()), curPlan) : null;
    const ladder = RANKS.map((r, i) => {
      const st = i <= achievedIdx ? '<span class="chip st-done">✓ erreicht</span>' : r === target ? '<span class="pill">nächstes Ziel</span>' : '';
      return `<tr class="${r === target ? 'target' : ''} ${i <= achievedIdx ? 'achieved' : ''}">
        <td>${esc(r.name)}</td><td>${fmt(r.leg)}</td><td>${fmt(r.leg)}</td><td><b>${fmt(r.leg * 2)}</b></td><td>${money(r.pay)}</td><td>${st}</td></tr>`;
    }).join('');
    // Was fehlt noch zum nächsten Rank? Ziel − Renewals − im aktuellen Cycle gesammeltes BV
    const cur = cycleFor(todayISO()) || state.cycles[state.cycles.length - 1];
    const goalBV = target.leg * 2, base = s.baseBV || 0, got = cur ? cycleSum(cur, ['quali_volume']) : 0;
    const missing = Math.max(0, goalBV - base - got);
    app.innerHTML = `
      <div class="page-head"><div><h1>Einstellungen</h1><div class="sub">Rank, Wochenziele und Export</div></div></div>
      <div class="stack">
        <section class="card">
          <div class="card-head"><h2>Dein Rank</h2></div>
          <div class="rank-top">
            <label class="field">Höchster erreichter Rank
              <select class="input" data-action="achieved-rank">
                <option value="" ${achievedIdx < 0 ? 'selected' : ''}>Noch keiner</option>
                ${RANKS.map((r) => `<option ${r.name === s.achievedRank ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
              </select></label>
            <div class="target-box">
              <div class="muted small">Nächster Rank</div>
              <div class="rank-name">${esc(target.name)}</div>
              <div class="small">${fmt(target.leg)} BV links + ${fmt(target.leg)} BV rechts = <b>${fmt(target.leg * 2)} BV</b> pro Cycle · ${money(target.pay)} Residual</div>
            </div>
          </div>
          <label class="field base-bv">BV Renewals – schon am Anfang des Cycles da<div class="row"><input class="input num" inputmode="decimal" data-base value="${s.baseBV || 0}"><span class="muted small">BV</span></div></label>
          <div class="gap-box ${missing ? '' : 'done'}">
            <span class="gap-label">Fehlt noch</span>
            <span class="gap-val">${missing ? `${fmt(missing)} BV` : '✓ Geschafft'}</span>
            <span class="gap-pct">${missing ? `${Math.round((missing / goalBV) * 100)} %` : '100 %'}</span>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Rank-Übersicht</h2></div>
          <div class="tbl-wrap rank-wrap"><table class="tbl rank-tbl">
            <thead><tr><th>Rank</th><th>BV links</th><th>BV rechts</th><th>BV gesamt</th><th>Residual / Cycle</th><th></th></tr></thead>
            <tbody>${ladder}</tbody></table></div>
        </section>

        <section class="card">
          <div class="card-head"><h2>ToDo-Ziele</h2></div>
          <div class="set-grid">
            ${goalInput('tiktok', 'TikToks posten', 'pro Tag')}
            ${goalInput('contacts', 'Kontakte anschreiben', 'pro Tag')}
            ${goalInput('testreel', 'Testreels', 'pro Tag')}
            ${goalInput('story', 'Stories', 'pro Tag')}
            ${goalInput('sprechstory', 'Sprechstories', 'pro Woche')}
            ${goalInput('sprechtiktok', 'Sprech-TikToks', 'pro Woche')}
            ${goalInput('followups', 'Alle Kontakte nachfassen', 'pro Cycle')}
            ${goalInput('offline', 'Offline Meeting', 'pro Cycle')}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Wochenziele</h2></div>
          <div class="set-grid">
            <div class="field">BV<div class="row" style="min-height:44px"><b style="font-size:1.05rem">${bvNow != null ? fmt(bvNow) : '–'}</b><span class="muted small">diese Woche</span></div></div>
            ${goalInput('closingsWeek', 'Closings', 'pro Woche', '–')}
            ${goalInput('starterWeek', 'Starter', 'pro Woche', '–')}
          </div>
          <p class="muted small" style="margin:10px 0 0">BV wird automatisch berechnet: Gesamt-BV ÷ 4 Wochen. Was in einer Woche fehlt, wird auf die restlichen Wochen aufgeteilt – so kommst du am Ende des Cycles genau auf dein Ziel. Closings und Starter leer lassen = kein Ziel.</p>
        </section>

        ${c ? '' : noCycleCard()}

        ${syncCard()}

        <section class="card">
          <div class="card-head"><h2>Daten & Backup</h2></div>
          <div class="row wrap">
            <button class="btn primary" data-action="export-xlsx">⇩ Alles exportieren (Excel)</button>
            <button class="btn" data-action="export-json">⇩ Backup herunterladen</button>
            ${importBtn()}
            <label class="btn">⇧ Backup wiederherstellen<input type="file" accept=".json,application/json" data-action="import-json" hidden></label>
            ${window.SEED_DATA ? '<button class="btn danger" data-action="reset-seed">Excel-Daten neu laden</button>' : ''}
          </div>
          <p class="hint" style="margin-bottom:0">Excel importieren: deine alte Accountability-Excel (ein Blatt pro Cycle) oder ein Export aus dieser App. Bereits eingetragene Werte bleiben erhalten – es werden nur leere Felder ergänzt.</p>
        </section>
      </div>`;
  }
  function importBtn() {
    return `<label class="btn">⇧ Excel importieren<input type="file" accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" data-action="import-xlsx" hidden></label>`;
  }

  function syncCard() {
    if (sync?.gistId) {
      return `<section class="card">
        <div class="card-head"><h2>Synchronisierung</h2><span class="chip st-done">✓ aktiv</span></div>
        <div class="muted small">GitHub: @${esc(sync.user || '')}${lastSync ? ` · zuletzt ${pad(lastSync.getHours())}:${pad(lastSync.getMinutes())}` : ''}</div>
        <div class="row wrap" style="margin-top:12px">
          <button class="btn ghost danger" data-action="sync-disconnect">Trennen</button>
        </div>
      </section>`;
    }
    return `<section class="card">
      <div class="card-head"><h2>Synchronisierung</h2></div>
      <ol class="steps">
        <li><a href="https://github.com/settings/tokens/new?scopes=gist&description=Accountability%20Sync" target="_blank" rel="noopener">Token erstellen</a> (nur Haken bei „gist“)</li>
        <li>Token hier einfügen – auf jedem Gerät einmal</li>
      </ol>
      <div class="row wrap">
        <input class="input" id="syncToken" type="password" autocomplete="off" placeholder="ghp_…" style="flex:1;min-width:200px">
        <button class="btn primary" data-action="sync-connect">Verbinden</button>
      </div>
    </section>`;
  }

  function newCycle(start) {
    const last = state.cycles[state.cycles.length - 1];
    const num = last && (last.name.match(/Cycle\s*(\d+)/i) || [])[1];
    let s = start || (last ? addDays(cycleEnd(last), 1) : todayISO());
    if (cycleFor(s)) s = addDays(cycleEnd(last), 1);
    const c = { id: `c${Date.now()}`, name: num ? `Cycle ${Number(num) + 1}` : 'Neuer Cycle', start: s, length: 28,
      targetRank: nextRank(state.settings.achievedRank).name, weekNotes: ['', '', '', ''], entries: {}, ts: {}, metaTs: Date.now() };
    state.cycles.push(c); normalize(); save();
    ui.cycleId = c.id;
    if (ui.view === 'today' && !cycleFor(ui.date)) ui.date = c.start;
    toast(`${c.name} angelegt · Ziel: ${c.targetRank}`);
    render();
  }

  /* ---------- Export / Import ---------- */
  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCSV(c) {
    const cols = SHEET_SECTIONS.flatMap((s) => s.cols);
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['Datum', 'Tag', ...cols.map(colLabel)].map(q).join(';')];
    for (const d of cycleDates(c)) {
      lines.push([fmtShort(d) + parse(d).getFullYear(), WD[parse(d).getDay()], ...cols.map((k) => {
        const v = cellOut(c, d, k);
        return typeof v === 'number' ? String(v).replace('.', ',') : v ?? '';
      })].map(q).join(';'));
    }
    download(`${slug(c.name)}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function fallbackCopy(txt, cb) {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch { toast('Kopieren nicht möglich – bitte markieren'); }
    ta.remove();
  }

  // Alles als Excel: Übersichtsblatt + ein Blatt pro Cycle
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => res(window.XLSX); s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function cellOut(c, d, k) {
    if (k === '__contacts') return todoValue(c, d, DAILY_TODOS[1]) || '';
    if (k === 'pd_text') return pdSummary(c, d);
    const v = getVal(c, d, k); return typeof v === 'number' ? v : '';
  }
  async function exportXLSX() {
    const cols = SHEET_SECTIONS.flatMap((s) => s.cols);
    try {
      toast('Excel wird erstellt …');
      const X = await loadXLSX();
      const wb = X.utils.book_new();
      const sumKeys = cols.filter((k) => k !== 'pd_text');
      const overview = [['Cycle', 'Start', 'Ende', 'Rank-Ziel', 'Ø ToDos erledigt %', ...sumKeys.map(colLabel)]];
      for (const c of [...state.cycles].reverse()) {
        const days = elapsedDays(c);
        let s = 0; for (let i = 0; i < days; i++) s += dayScore(c, addDays(c.start, i)).pct;
        overview.push([c.name, fmtShort(c.start) + parse(c.start).getFullYear(), fmtShort(cycleEnd(c)) + parse(cycleEnd(c)).getFullYear(), c.targetRank || '',
          days ? Math.round(s / days) : '', ...sumKeys.map((k) => (k === '__contacts' ? cycleSum(c, CONTACT_KEYS) : cycleSum(c, [k])))]);
      }
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(overview), 'Übersicht');
      const used = new Set(['Übersicht']);
      for (const c of [...state.cycles].reverse()) {
        const rows = [['Datum', 'Tag', 'Woche', ...cols.map(colLabel)]];
        cycleDates(c).forEach((d, i) => rows.push([fmtShort(d) + parse(d).getFullYear(), WD[parse(d).getDay()], Math.floor(i / 7) + 1, ...cols.map((k) => cellOut(c, d, k))]));
        rows.push(['Summe', '', '', ...cols.map((k) => (k === 'pd_text' ? '' : k === '__contacts' ? cycleSum(c, CONTACT_KEYS) : cycleSum(c, [k])))]);
        rows.push([]);
        for (let w = 0; w < weeksOf(c); w++) {
          rows.push([`Woche ${w + 1}`, '', '', `Leuten das Business gezeigt: ${weekSum(c, ['sales_closing'], w)}`, `Starter: ${weekSum(c, ['quali_starter'], w)}`, c.weekNotes[w] || '']);
        }
        let name = c.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31), n = 2;
        while (used.has(name)) name = `${c.name.slice(0, 28)} ${n++}`;
        used.add(name);
        const ws = X.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 5 }, { wch: 7 }, ...cols.map((k) => ({ wch: k === 'pd_text' ? 28 : 12 }))];
        X.utils.book_append_sheet(wb, ws, name);
      }
      X.writeFile(wb, `Accountability-Export-${todayISO()}.xlsx`);
      toast('Excel-Export heruntergeladen');
    } catch {
      // Ohne Internet: alles als eine CSV-Datei
      const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      const lines = [['Cycle', 'Datum', 'Tag', ...cols.map(colLabel)].map(q).join(';')];
      for (const c of state.cycles) for (const d of cycleDates(c)) {
        lines.push([c.name, fmtShort(d) + parse(d).getFullYear(), WD[parse(d).getDay()], ...cols.map((k) => String(cellOut(c, d, k)).replace('.', ','))].map(q).join(';'));
      }
      download(`Accountability-Export-${todayISO()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
      toast('Offline: Export als CSV heruntergeladen');
    }
  }

  /* ---------- Excel-Import (vergangene Ergebnisse) ---------- */
  async function importXLSX(file) {
    let X;
    try { toast('Excel wird gelesen …'); X = await loadXLSX(); } catch { toast('Für den Excel-Import wird Internet benötigt'); return; }
    let found;
    try { found = window.parseAccountabilityWorkbook(X, X.read(await file.arrayBuffer(), { cellDates: true })); } catch { toast('Excel-Datei konnte nicht gelesen werden'); return; }
    found = found.filter((x) => Object.keys(x.entries).length);
    if (!found.length) { toast('Keine Tagesdaten in der Datei gefunden'); return; }
    const days = found.reduce((s, x) => s + Object.keys(x.entries).length, 0);
    const list = found.map((x) => `• ${x.name} (ab ${fmtShort(x.start)}${x.start.slice(0, 4)})`).join('\n');
    if (!confirm(`${found.length} ${found.length === 1 ? 'Cycle' : 'Cycles'} mit ${days} eingetragenen Tagen gefunden:\n${list}\n\nImportieren? Bereits eingetragene Werte bleiben erhalten, nur leere Felder werden ergänzt.`)) return;

    const now = Date.now(), today = todayISO();
    let added = 0, merged = 0, skipped = 0;
    const overlapsAny = (s, e) => state.cycles.some((c) => c.start <= e && cycleEnd(c) >= s);
    const addCycle = (name, start, length) => {
      const end = addDays(start, length - 1);
      const c = { id: `x${now}_${added}`, name: state.cycles.some((x) => x.name === name) ? `${name} (Import)` : name, start, length,
        targetRank: end >= today ? nextRank(state.settings.achievedRank).name : null, weekNotes: [], entries: {}, ts: {}, metaTs: now };
      state.cycles.push(c); added++; normalize();
      return c;
    };
    const put = (c, d, e) => {
      const cur = c.entries[d] || {};
      let changed = false;
      for (const [k, v] of Object.entries(e)) {
        if (k === 'pd_text' && (cur.pd_text || (Array.isArray(cur.pd) && cur.pd.length))) continue;
        if (cur[k] === undefined || cur[k] === null || cur[k] === '') { cur[k] = v; changed = true; }
      }
      if (changed) { c.entries[d] = cur; c.ts[d] = now; merged++; }
    };
    for (const imp of found) {
      if (!overlapsAny(imp.start, addDays(imp.start, imp.length - 1))) addCycle(imp.name, imp.start, imp.length);
      // Jeden Tag in den Cycle schreiben, der dieses Datum enthält
      const loose = [];
      for (const [d, e] of Object.entries(imp.entries)) { const c = cycleFor(d); if (c) put(c, d, e); else loose.push(d); }
      // Tage außerhalb aller Cycles: eigener Cycle, falls der Zeitraum frei ist
      if (loose.length) {
        loose.sort();
        const s = loose[0], l = diffDays(s, loose[loose.length - 1]) + 1;
        if (!overlapsAny(s, addDays(s, l - 1))) { const c = addCycle(imp.name, s, l); for (const d of loose) put(c, d, imp.entries[d]); }
        else skipped += loose.length;
      }
    }
    normalize(); save(); ui.cycleId = null; render();
    toast(`Import fertig: ${added} neue ${added === 1 ? 'Cycle' : 'Cycles'}, ${merged} Tage ergänzt${skipped ? `, ${skipped} übersprungen` : ''}`);
  }

  /* ---------- Toast & Tooltip ---------- */
  let toastTimer;
  function toast(t) {
    const el = $('#toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  const tipEl = $('#tooltip');
  function showTip(html, x, y) {
    tipEl.innerHTML = html; tipEl.classList.add('show');
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = `${Math.min(window.innerWidth - r.width - 8, x + 14)}px`;
    tipEl.style.top = `${Math.max(8, y - r.height - 10)}px`;
  }
  function hideTip() { tipEl.classList.remove('show'); }

  /* ================= Events ================= */
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    if (a.startsWith('mk-')) { mkAction(a, el); return; }
    if (a === 'day') { ui.date = addDays(ui.date, Number(el.dataset.delta)); render(); }
    else if (a === 'go-today') { ui.date = todayISO(); render(); }
    else if (a === 'copy-acc') { const c = cycleFor(ui.date); if (c) copyText(accountabilityText(c, ui.date), 'Accountability kopiert'); }
    else if (a === 'fu-toggle') {
      // Einmal pro Cycle: Haken setzt den Tag, Haken weg löscht ihn im ganzen Cycle
      const c = cycleFor(ui.date); if (!c) return;
      if (cycleSum(c, ['pro_cycle_followups']) > 0) {
        for (const d of Object.keys(c.entries)) if (c.entries[d]?.pro_cycle_followups != null) setValue(c, d, 'pro_cycle_followups', null);
      } else setValue(c, ui.date, 'pro_cycle_followups', 1);
      render();
    }
    else if (a === 'bv-add') {
      const c = cycleFor(ui.date); if (!c) return;
      const nv = numVal(c, ui.date, 'quali_volume') + Number(el.dataset.v);
      setValue(c, ui.date, 'quali_volume', nv);
      const inp = $('input[data-key="quali_volume"]', app); if (inp) inp.value = nv;
      refreshToday(c, ui.date);
      toast(`+${fmt(Number(el.dataset.v))} BV`);
    }
    else if (a === 'step') {
      const c = cycleFor(ui.date); if (!c) return;
      const key = el.dataset.key;
      const nv = Math.max(0, numVal(c, ui.date, key) + Number(el.dataset.delta));
      setValue(c, ui.date, key, nv);
      const inp = $(`input[data-key="${key}"]`, app); if (inp) inp.value = nv;
      refreshToday(c, ui.date);
    }
    else if (a === 'pd-pick') {
      const c = cycleFor(ui.date); if (!c) return;
      const ti = $('#pdTitle'), note = splitPd(ti.value).note;
      ti.value = `${el.dataset.title} ${note}`.trimEnd() + (note ? '' : ' ');
      $('#pdChips').innerHTML = pdChips(c, ui.date, el.dataset.title);
      ti.focus({ preventScroll: true });
      const n = ti.value.length; try { ti.setSelectionRange(n, n); } catch { /* type=search */ }
    }
    else if (a === 'pd-add') { const c = cycleFor(ui.date); if (c) pdAdd(c, ui.date); }
    else if (a === 'pd-del' || a === 'pd-del-legacy') {
      const c = cycleFor(ui.date); if (!c) return;
      if (a === 'pd-del') { const items = pdItems(c, ui.date).filter((_, i) => i !== Number(el.dataset.i)); setValue(c, ui.date, 'pd', items.length ? items : null); }
      else setValue(c, ui.date, 'pd_text', null);
      $('#pdBox').innerHTML = pdBox(c, ui.date);
      refreshToday(c, ui.date);
    }
    else if (a === 'copy-report') {
      const txt = $('#reportText').textContent;
      const done = () => toast('Text kopiert');
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
      else fallbackCopy(txt, done);
    }
    else if (a === 'export-xlsx') exportXLSX();
    else if (a === 'new-cycle') newCycle(el.dataset.start || null);
    else if (a === 'export-csv') exportCSV(selectedCycle());
    else if (a === 'export-json') { download(`accountability-backup-${todayISO()}.json`, JSON.stringify(state, null, 1), 'application/json'); toast('Backup heruntergeladen'); }
    else if (a === 'sync-connect') { const v = $('#syncToken').value; if (v.trim()) { el.disabled = true; el.textContent = 'Verbinde …'; connectSync(v); } }
    else if (a === 'sync-now') runSync();
    else if (a === 'go-settings') setView('settings');
    else if (a === 'sync-disconnect') { if (confirm('Sync auf diesem Gerät trennen? Deine Daten bleiben erhalten.')) disconnectSync(); }
    else if (a === 'rates-history') { state.settings.rates = historyRates(state.cycles); touchSettings(); save(); render(); toast('Quoten aus deiner Historie berechnet'); }
    else if (a === 'reset-seed') {
      if (!window.SEED_DATA) return toast('Keine Excel-Daten gefunden');
      if (confirm('Alle aktuellen Daten durch die Daten aus der Excel-Datei ersetzen? Tipp: Vorher ein Backup herunterladen.')) {
        state = migrate(clone(window.SEED_DATA)); normalize(); ui.cycleId = null; save(); render(); toast('Excel-Daten geladen');
      }
    }
    else if (a === 'delete-cycle') {
      const c = selectedCycle();
      if (c && confirm(`„${c.name}“ mit allen Einträgen wirklich löschen?`)) {
        state.deleted[c.id] = Date.now();
        state.cycles = state.cycles.filter((x) => x !== c); ui.cycleId = null; save(); render(); toast('Cycle gelöscht');
      }
    }
  });

  app.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'pdTitle') { const c = cycleFor(ui.date); if (c) { $('#pdChips').innerHTML = pdChips(c, ui.date, t.value); $('#pdChips').scrollLeft = 0; } return; }
    if (t.dataset.mk && ui.mkDraft) { ui.mkDraft[t.dataset.mk] = t.value; return; }
    if (t.dataset.mkSearch !== undefined) { ui.mkQuery = t.value; $('#mkList').innerHTML = mkList(); return; }
    if (ui.view === 'today' && t.dataset.key) {
      const c = cycleFor(ui.date); if (!c) return;
      const key = t.dataset.key;
      setValue(c, ui.date, key, key === 'pd_text' ? (t.value.trim() ? t.value : null) : parseNum(t.value));
      refreshToday(c, ui.date);
      return;
    }
    if (t.dataset.note !== undefined) { const c = selectedCycle(); c.weekNotes[Number(t.dataset.note)] = t.value; touchCycle(c); save(); }
  });

  app.addEventListener('change', (e) => {
    const t = e.target, a = t.dataset.action, s = state.settings;
    if (a === 'pick-cycle') { ui.cycleId = t.value; render(); return; }
    if (a === 'pick-date' && t.value) { ui.date = t.value; render(); return; }
    if (a === 'achieved-rank') {
      s.achievedRank = t.value || null; touchSettings();
      const nr = nextRank(s.achievedRank).name;
      normalize(); save(); render(); toast(`Nächstes Ziel: ${nr}`); return;
    }
    if (a === 'import-xlsx') { const f = t.files[0]; t.value = ''; if (f) importXLSX(f); return; }
    if (a === 'import-json') {
      const f = t.files[0]; if (!f) return;
      f.text().then((txt) => {
        const d = JSON.parse(txt);
        if (!d || !Array.isArray(d.cycles)) throw new Error('format');
        if (!confirm(`Backup mit ${d.cycles.length} Cycles laden? Die aktuellen Daten werden ersetzt.`)) return;
        state = migrate(d); normalize(); ui.cycleId = null; save(); render(); toast('Backup wiederhergestellt');
      }).catch(() => toast('Datei konnte nicht gelesen werden')).finally(() => { t.value = ''; });
      return;
    }
    if (t.dataset.goal) {
      const v = parseNum(t.value), opt = t.dataset.goal === 'closingsWeek' || t.dataset.goal === 'starterWeek';
      if (v !== null && v >= 0) s.goals[t.dataset.goal] = v; else if (opt && !t.value.trim()) s.goals[t.dataset.goal] = null;
      touchSettings(); save(); return;
    }
    if (t.dataset.rate) { const v = parseNum(t.value); if (v !== null && v > 0) s.rates[t.dataset.rate] = v; touchSettings(); save(); render(); return; }
    if (t.dataset.base !== undefined) { s.baseBV = Math.max(0, parseNum(t.value) || 0); touchSettings(); save(); render(); return; }
  });

  app.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Enter' && t.id === 'pdTitle') {
      e.preventDefault();
      const c = cycleFor(ui.date); if (c) pdAdd(c, ui.date);
      return;
    }
    if (ui.view === 'today' && t.matches('.stepper input') && e.key === 'Enter') {
      const all = $$('.stepper input', app), i = all.indexOf(t);
      if (all[i + 1]) { all[i + 1].focus(); all[i + 1].select(); }
    }
  });
  // Datum: Tippen auf die Datumsanzeige öffnet den Kalender
  app.addEventListener('click', (e) => {
    const d = e.target.closest('input[type=date]');
    if (d && typeof d.showPicker === 'function') { try { d.showPicker(); } catch { /* Browser öffnet selbst */ } }
  });
  app.addEventListener('focusin', (e) => { if (e.target.matches('.stepper input, td.c input')) e.target.select(); });
  document.addEventListener('keydown', (e) => {
    if (ui.view !== 'today' || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { ui.date = addDays(ui.date, -1); render(); }
    if (e.key === 'ArrowRight') { ui.date = addDays(ui.date, 1); render(); }
  });
  app.addEventListener('mousemove', (e) => { const g = e.target.closest('[data-tip]'); if (g) showTip(g.dataset.tip, e.clientX, e.clientY); else hideTip(); });
  app.addEventListener('mouseleave', hideTip);

  // Handy: kein Zoom durch schnelles Doppeltippen oder Zwei-Finger-Geste (iOS ignoriert user-scalable=no)
  ['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  let lastTouchEnd = 0, touchX = 0, touchY = 0, touchMoved = false;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; touchX = t.clientX; touchY = t.clientY; touchMoved = e.touches.length > 1; }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false }); // kein Pinch-Zoom
  document.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (Math.abs(t.clientX - touchX) > 10 || Math.abs(t.clientY - touchY) > 10) touchMoved = true; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (touchMoved) { lastTouchEnd = 0; return; }
    if (now - lastTouchEnd < 350 && !e.target.closest('input, textarea, select')) {
      e.preventDefault();
      const b = e.target.closest('button, label.btn, [data-action]');
      if (b && !b.matches('input')) b.click(); // schneller zweiter Tipp zählt trotzdem
    }
    lastTouchEnd = now;
  }, { passive: false });

  /* ---------- Theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  applyTheme(lsGet('acc.theme'));
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const t = dark ? 'light' : 'dark'; applyTheme(t); lsSet('acc.theme', t);
  });

  let lastToday = todayISO();
  setInterval(() => { const t = todayISO(); if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; normalize(); save(); render(); } }, 60000);

  // Sync: beim Öffnen, beim Zurückkehren zur App und alle 30 s
  app.addEventListener('focusout', () => {
    setTimeout(() => {
      if (pendingRender && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#app input, #app textarea'))) { pendingRender = false; render(); }
    }, 300);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(); });
  window.addEventListener('online', () => runSync());
  window.addEventListener('focus', () => runSync());
  window.addEventListener('pageshow', (e) => { if (e.persisted) runSync(); });
  setInterval(() => { if (document.visibilityState === 'visible') runSync(); }, 20000);

  const firstRun = !lsGet(STORE_KEY);
  save();
  if (firstRun && state.cycles.length && window.SEED_DATA) setTimeout(() => toast(`${state.cycles.length} Cycles aus deiner Excel übernommen`), 300);
  if (location.hash && location.hash !== '#today') history.replaceState(null, '', '#today');
  render();
  if (sync?.gistId) runSync();
})();
