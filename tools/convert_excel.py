"""Konvertiert Accountability.xlsx -> seed-data.js (einmaliger Import der Historie)."""
import json, re, sys, datetime, openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else "Accountability.xlsx"
DST = sys.argv[2] if len(sys.argv) > 2 else "seed-data.js"

PER_CYCLE = {"Checkups", "Followups", "Offline Meetings"}
LABEL_FIX = {"Closings": "Closing", "Neins": "Nein's", "Numern": "Nummern", "Nos": "Nein's",
             "Personal Developement": "Personal Development"}
GROUP_FIX = {"TIKTOK": "TikTok", "INSTAGRAM": "Instagram", "Quali": "Quali", "Team": "Team",
             "Personal Developement": "Personal Development"}

def slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")

def fix(s):
    s = str(s).strip().replace("\ufffd", "ä")
    return LABEL_FIX.get(s, s)

def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

def convert(ws):
    # Header row = row containing "Gepostet"
    hdr = next(r for r in range(1, 40) if any(c.value == "Gepostet" for c in ws[r]))
    grp_row, goal_row = hdr - 1, hdr + 1
    merged = {m.min_col: (m.min_col, m.max_col) for m in ws.merged_cells.ranges if m.min_row == grp_row}
    col_group, text_cols = {}, set()
    for c in ws[grp_row]:
        if c.value:
            g = GROUP_FIX.get(str(c.value).strip(), str(c.value).strip())
            lo, hi = merged.get(c.column, (c.column, c.column))
            for col in range(lo, hi + 1):
                col_group[col] = g
            if g == "Personal Development":
                text_cols.add(c.column)
    metrics, colmap = [], {}
    used = set()
    for c in ws[hdr]:
        col = c.column
        if col in text_cols:
            continue
        if not c.value:
            continue
        label = fix(c.value)
        group = "Pro Cycle" if label in PER_CYCLE else ("TikTok" if label == "Neue Follower" else col_group.get(col, "Sales"))
        key = slug(f"{group}_{label}")
        if key in used:
            continue
        used.add(key)
        goal = ws.cell(goal_row, col).value
        m = {"key": key, "label": label, "group": group, "daily": num(goal), "type": "num"}
        if isinstance(goal, str):
            m["note"] = goal
        metrics.append(m)
        colmap[col] = key
    for col in sorted(text_cols):
        g = ws.cell(goal_row, col).value
        metrics.append({"key": "pd_text", "label": "Personal Development", "group": "Personal Development",
                        "daily": None, "type": "text", "note": str(g) if g is not None else "1x täglich"})
        colmap[col] = "pd_text"
    # Days
    entries, dates = {}, []
    for r in range(goal_row + 1, ws.max_row + 1):
        d = ws.cell(r, 3).value
        if not isinstance(d, datetime.datetime):
            if dates and ws.cell(r, 3).value is None and ws.cell(r, 2).value is None:
                break
            continue
        iso = d.date().isoformat()
        dates.append(iso)
        e = {}
        for col, key in colmap.items():
            v = ws.cell(r, col).value
            if v is None or v == "":
                continue
            if key == "pd_text":
                e[key] = str(v)
            elif num(v) is not None:
                e[key] = v
        if e:
            entries[iso] = e
    # Weekly goals: cells starting with "WOCHE"
    week_cells = sorted(((c.row, c.column) for row in ws.iter_rows() for c in row
                         if isinstance(c.value, str) and c.value.strip().upper().startswith("WOCHE")))
    weekly = []
    label_to_key = {m["label"]: m["key"] for m in metrics if m["group"] in ("Sales", "Quali", "Pro Cycle")}
    cycle_goals = {}
    for (r, col) in week_cells:
        goals = {}
        rr = r + 1
        while ws.cell(rr, col).value:
            lab = fix(ws.cell(rr, col).value)
            g = num(ws.cell(rr, col + 1).value)
            key = label_to_key.get(lab)
            if key and g is not None:
                if key.startswith("pro_cycle"):
                    cycle_goals[key] = g
                else:
                    goals[key] = g
            rr += 1
        weekly.append(goals)
    # Header goals (NEIN ZIEL /10, BV Ziel /10000)
    for row in ws.iter_rows(min_row=1, max_row=2):
        for c in row:
            if isinstance(c.value, str) and c.value.startswith("/"):
                try:
                    val = float(c.value[1:])
                except ValueError:
                    continue
                f = str(ws.cell(c.row, c.column - 1).value)
                m = re.search(r"SUM\(([A-Z]+)\d+", f)
                if m:
                    colnum = openpyxl.utils.column_index_from_string(m.group(1))
                    if colnum in colmap:
                        cycle_goals[colmap[colnum]] = val
    for m in metrics:
        if m["group"] == "Pro Cycle" and m["key"] not in cycle_goals and m.get("note", "").startswith("1/cycle"):
            if "teami" not in m["note"]:
                cycle_goals[m["key"]] = 1
    # "Leuten das Business gezeigt" names per week
    week_notes = []
    for row in ws.iter_rows(min_row=1, max_row=15):
        for c in row:
            if isinstance(c.value, str) and re.match(r"Woche \d", c.value.strip()):
                n = ws.cell(c.row, c.column + 2).value
                week_notes.append("" if n in (None, "/") else str(n))
    n_weeks = max(1, -(-len(dates) // 7))
    weekly = (weekly + [{}] * n_weeks)[:n_weeks]
    title = str(ws["C1"].value or ws.title).strip()
    if "60-Day" in title and ws.title.startswith("C"):
        title = title.replace("60-Day Run", "").strip() + " · 60-Day Run"
    if ws.title.startswith("April"):
        title = "60-Day Run (April–Mai 2026)"
    if ws.title == "C82":
        title = "Cycle 82"  # Excel-Titel war versehentlich "Cycle 81"
    return {"id": slug(ws.title), "name": title, "sheet": ws.title, "start": dates[0], "length": len(dates),
            "metrics": metrics, "weeklyGoals": weekly, "cycleGoals": cycle_goals,
            "weekNotes": (week_notes + [""] * n_weeks)[:n_weeks], "entries": entries}

wb = openpyxl.load_workbook(SRC, data_only=False)
cycles = [convert(wb[n]) for n in wb.sheetnames]
cycles.sort(key=lambda c: c["start"])
with open(DST, "w", encoding="utf-8") as f:
    f.write("// Automatisch aus Accountability.xlsx erzeugt (tools/convert_excel.py)\n")
    f.write("window.SEED_DATA = ")
    json.dump({"version": 1, "cycles": cycles}, f, ensure_ascii=False, indent=1)
    f.write(";\n")
for c in cycles:
    print(c["sheet"], "|", c["name"], c["start"], c["length"], "days |", len(c["entries"]), "entries")
    print("   metrics:", [(m["group"][:4], m["label"], m["daily"]) for m in c["metrics"]])
    print("   weekly:", c["weeklyGoals"], "\n   cycle:", c["cycleGoals"], "notes:", c["weekNotes"])
