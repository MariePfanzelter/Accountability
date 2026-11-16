/* Excel-Import: liest die ursprüngliche Accountability.xlsx (eine Tabelle pro Cycle)
   und den Excel-Export dieser App. Ergebnis: [{ name, start, length, entries }] */
(function (root) {
  'use strict';

  const norm = (s) => String(s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');

  // Spaltenüberschrift -> Schlüssel (Original-Excel + Bezeichnungen aus dem App-Export)
  const LABELS = {
    gepostet: 'tiktok_gepostet', tiktoksgepostet: 'tiktok_gepostet',
    liker: 'tiktok_liker', likertiktok: 'tiktok_liker',
    ka: 'tiktok_ka', katiktok: 'tiktok_ka', kaltakquisetiktok: 'tiktok_ka',
    neuefollower: 'tiktok_neue_follower',
    testreelliker: 'instagram_testreelliker', likerinstagram: 'instagram_testreelliker',
    testreels: 'instagram_testreels', testreel: 'instagram_testreels',
    stories: 'instagram_stories', story: 'instagram_stories',
    sprechstories: 'instagram_sprechstories', sprechstory: 'instagram_sprechstories',
    sprechtiktoks: 'tiktok_sprechtiktoks', sprechtiktok: 'tiktok_sprechtiktoks',
    nummern: 'sales_nummern', numern: 'sales_nummern',
    fcs: 'sales_fcs', firstcalls: 'sales_fcs',
    praesis: 'sales_praesis', praesisrausgeschickt: 'sales_praesis',
    closing: 'sales_closing', closings: 'sales_closing',
    fuclosing: 'sales_fu_closing', fuclosings: 'sales_fu_closing', followupclosings: 'sales_fu_closing',
    neins: 'sales_neins', nos: 'sales_neins', neinsgesammelt: 'sales_neins',
    starter: 'quali_starter',
    volume: 'quali_volume', bv: 'quali_volume', volumenbv: 'quali_volume',
    teamclosings: 'team_closing', closingsimteam: 'team_closing',
    teamstarter: 'team_starter', starterimteam: 'team_starter',
    checkups: 'pro_cycle_checkups',
    followups: 'pro_cycle_followups', nachgefasst: 'pro_cycle_followups', allekontaktenachgefasst: 'pro_cycle_followups',
    offlinemeetings: 'pro_cycle_offline_meetings', offlinemeeting: 'pro_cycle_offline_meetings', offlinemeetingorganisiert: 'pro_cycle_offline_meetings',
    persoenlichkeitsentw: 'pd_text', persoenlichkeitsentwicklung: 'pd_text', personaldevelopment: 'pd_text', personaldevelopement: 'pd_text',
  };
  const TEAM = { sales_closing: 'team_closing', quali_starter: 'team_starter' };

  const pad = (n) => String(n).padStart(2, '0');
  // Excel-Datum robust in "YYYY-MM-DD" umwandeln (egal ob lokale oder UTC-Mitternacht)
  function toISO(v) {
    if (v instanceof Date && !isNaN(v)) {
      const d = new Date(v.getTime() + 12 * 3600e3);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    if (typeof v === 'string') {
      let m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
      m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    return null;
  }
  function num(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return Number(v.replace(',', '.'));
    return null;
  }
  const dayDiff = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => x - (i === 1))) - Date.UTC(...a.split('-').map((x, i) => x - (i === 1)))) / 864e5);

  function sheetName(n) {
    const m = n.match(/^C\s*(\d+)/i);
    return m ? `Cycle ${m[1]}` : n.trim();
  }

  function parseSheet(X, ws, name) {
    const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    // Kopfzeile: Original ("Gepostet") oder App-Export ("Datum")
    const hdr = rows.findIndex((r, i) => i < 60 && r && r.some((v) => v === 'Gepostet' || v === 'Datum'));
    if (hdr < 0) return null;
    const isExport = rows[hdr].includes('Datum');
    const head = rows[hdr], groups = rows[hdr - 1] || [];

    // Gruppen-Zeile über der Kopfzeile: jede Spalte gehört zur letzten Gruppe links davon
    const groupOf = [];
    let g = '';
    for (let c = 0; c < head.length; c++) { if (!isExport && groups[c]) g = norm(groups[c]); groupOf[c] = g; }

    const colmap = {};
    head.forEach((v, c) => {
      if (v == null || v === '') return;
      let key = LABELS[norm(v)];
      if (!key) return;
      if (groupOf[c] === 'team' && TEAM[key]) key = TEAM[key];
      if (Object.values(colmap).includes(key)) return;
      colmap[c] = key;
    });
    // Persönlichkeitsentwicklung steht im Original nur in der Gruppen-Zeile
    if (!isExport) groups.forEach((v, c) => { if (/personaldevelop/.test(norm(v))) colmap[c] = 'pd_text'; });

    const entries = {};
    let dateCol = isExport ? head.indexOf('Datum') : -1, first = null, last = null;
    for (let r = hdr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (dateCol < 0) {
        dateCol = row.findIndex((v) => v instanceof Date);
        if (dateCol < 0) continue;
      }
      const iso = toISO(row[dateCol]);
      if (!iso) { if (first) break; continue; }
      if (last && iso <= last) break; // Datum läuft rückwärts -> anderer Block
      if (!first) first = iso;
      last = iso;
      const e = {};
      for (const [c, key] of Object.entries(colmap)) {
        const v = row[c];
        if (v == null || v === '') continue;
        if (key === 'pd_text') { const s = String(v).trim(); if (s && s !== '/') e.pd_text = s === '✓' ? 1 : s; }
        else { const n = num(v); if (n !== null) e[key] = n; }
      }
      if (Object.keys(e).length) entries[iso] = e;
    }
    if (!first) return null;
    return { name: sheetName(name), start: first, length: dayDiff(first, last) + 1, entries };
  }

  function parseWorkbook(X, wb) {
    const out = [];
    for (const n of wb.SheetNames) {
      if (/^(übersicht|uebersicht)$/i.test(n.trim())) continue;
      const c = parseSheet(X, wb.Sheets[n], n);
      if (c) out.push(c);
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }

  root.parseAccountabilityWorkbook = parseWorkbook;
})(typeof window !== 'undefined' ? window : globalThis);
