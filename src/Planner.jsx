import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronRight, Plus, X, BarChart3, Clock,
  AlertTriangle, Trash2, CalendarDays, Target, Zap, CheckCircle2, Check, RotateCcw
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const DAY = 86400000;
const PALETTE = ["#f0b429", "#2dd4bf", "#a78bfa", "#fb7185", "#38bdf8", "#a3e635", "#f97316"];

const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY);
const today = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate())); };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const fmtHour = (h) => { const t = ((h % 24) + 24) % 24; const hh = Math.floor(t); const mm = Math.round((t - hh) * 60); const ap = hh < 12 ? "a" : "p"; const h12 = ((hh + 11) % 12) + 1; return `${h12}${mm ? ":" + String(mm).padStart(2, "0") : ""}${ap}`; };

// XP a task is worth: 10 / day of duration, ×1.5 if finished on or before its end date.
const taskXP = (t) => {
  const dur = Math.max(1, diffDays(t.end, t.start));
  const onTime = t.completedAt && t.completedAt <= t.end;
  return Math.round(dur * 10 * (onTime ? 1.5 : 1));
};
const LEVEL = 120; // XP per level

/* ---- persistence (works in a real deployment; no-ops safely if storage is blocked) ---- */
const LS_PROJECTS = "grid.projects.v1";
const LS_TASKS = "grid.tasks.v1";
const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } };

/* On-Task health → a potted plant that grows green & upright, or wilts & yellows */
function Plant({ score }) {
  const droop = Math.min(1, Math.max(0, (82 - score) / 82));     // 0 lush … 1 wilted
  const hue = 28 + (score / 100) * 102;                          // 28 brown → 130 green
  const leaf = `hsl(${hue} 58% ${44 + score * 0.07}%)`;
  const stem = `hsl(${hue} 45% ${34 + score * 0.05}%)`;
  const path = "M0 0 Q9 -7 18 -2 Q9 5 0 0 Z";
  const at = (x, y, a, s = 1) => `translate(${x} ${y}) rotate(${a}) scale(${s})`;
  const tr = { transition: "transform .8s ease, fill .7s ease" };
  return (
    <svg width="50" height="60" viewBox="0 0 60 70" style={{ overflow: "visible" }}>
      <path d="M19 52 L41 52 L38 67 Q30 69.5 22 67 Z" fill="#7c4a32" />
      <rect x="16" y="48" width="28" height="6" rx="2" fill="#8a5638" />
      <ellipse cx="30" cy="50" rx="11" ry="2.6" fill="#3a2418" />
      {score < 45 && <ellipse className="fade-in" cx="45" cy="65" rx="5" ry="2" fill={`hsl(${hue} 42% 38%)`} transform="rotate(18 45 65)" />}
      <g className="sway" style={{ transformOrigin: "30px 52px" }}>
        <line x1="30" y1="52" x2="30" y2="24" stroke={stem} strokeWidth="2.4" strokeLinecap="round" style={{ transition: "stroke .7s" }} />
        <path d={path} fill={leaf} style={tr} transform={at(30, 34, -45 + droop * 90)} />
        <path d={path} fill={leaf} style={tr} transform={at(30, 34, 225 - droop * 90)} />
        <path d={path} fill={leaf} style={tr} transform={at(30, 24, 270 - droop * 22, 1 - droop * 0.3)} />
      </g>
    </svg>
  );
}

/* Progress/XP → a jar that fills with coins; coins drop on completion, sparkles on level-up */
function CoinJar({ ratio, dropKey, sparkleKey }) {
  const top = 18, bot = 56, h = bot - top;
  const fillH = Math.max(0, Math.min(1, ratio)) * h;
  const fillY = bot - fillH;
  return (
    <svg width="42" height="58" viewBox="0 0 48 66" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id="jarclip"><rect x="9" y="16" width="30" height="42" rx="6" /></clipPath>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd56b" /><stop offset="1" stopColor="#e0992b" />
        </linearGradient>
      </defs>
      <g clipPath="url(#jarclip)">
        <rect x="9" width="30" y={fillY} height={fillH + 2} fill="url(#gold)" style={{ transition: "y .55s ease, height .55s ease" }} />
        {ratio > 0.04 && <ellipse cx="24" cy={fillY + 2} rx="13" ry="2.6" fill="#fff3c4" opacity="0.55" style={{ transition: "cy .55s ease" }} />}
      </g>
      <rect x="9" y="16" width="30" height="42" rx="6" fill="rgba(255,255,255,.04)" stroke="#9fb0c0" strokeWidth="1.6" />
      <rect x="12" y="9" width="24" height="9" rx="3.5" fill="rgba(255,255,255,.05)" stroke="#9fb0c0" strokeWidth="1.6" />
      <rect x="12" y="21" width="3.5" height="30" rx="2" fill="rgba(255,255,255,.13)" />
      {dropKey ? <circle key={dropKey} className="coindrop" cx="24" cy="4" r="5" fill="url(#gold)" stroke="#b9781f" strokeWidth="1" /> : null}
      {sparkleKey ? (
        <g key={sparkleKey}>
          {[2, 14, 26, 38, 46].map((x, i) => (
            <text key={i} x={x} y={i % 2 ? 4 : 16} fontSize="9" fill="#ffd56b" className="spark" style={{ animationDelay: `${i * 70}ms` }}>✦</text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */
const T = today();
const seedProjects = [
  { id: "p1", name: "VTOL Delivery Drone", color: PALETTE[1] },
  { id: "p2", name: "ME Internship Build", color: PALETTE[0] },
  { id: "p3", name: "Applications", color: PALETTE[2] },
];
const seedTasks = [
  { id: "t1", pid: "p1", name: "Payload & range sizing", start: addDays(T, -6), end: addDays(T, 1), progress: 100, done: true, completedAt: T, blocks: [] },
  { id: "t2", pid: "p1", name: "Airframe CAD", start: addDays(T, 0), end: addDays(T, 8), progress: 30, blocks: [{ id: "b1", date: T, s: 9, e: 11 }] },
  { id: "t3", pid: "p1", name: "BVLOS regulatory brief", start: addDays(T, 2), end: addDays(T, 6), progress: 0, blocks: [] },
  { id: "t4", pid: "p1", name: "Prototype build", start: addDays(T, 8), end: addDays(T, 24), progress: 0, blocks: [] },
  { id: "t5", pid: "p1", name: "Test flights", start: addDays(T, 24), end: addDays(T, 34), progress: 0, blocks: [] },
  { id: "t6", pid: "p2", name: "Teardown 2007 City", start: addDays(T, -3), end: addDays(T, 4), progress: 55, blocks: [{ id: "b2", date: T, s: 14, e: 17 }] },
  { id: "t7", pid: "p2", name: "Dyno frame fabrication", start: addDays(T, 4), end: addDays(T, 18), progress: 0, blocks: [] },
  { id: "t8", pid: "p2", name: "Sensor & wiring", start: addDays(T, 14), end: addDays(T, 22), progress: 0, blocks: [] },
  { id: "t9", pid: "p2", name: "Build writeup", start: addDays(T, 20), end: addDays(T, 26), progress: 0, blocks: [] },
  { id: "t10", pid: "p3", name: "Resume + portfolio site", start: addDays(T, -2), end: addDays(T, 9), progress: 20, blocks: [] },
  { id: "t11", pid: "p3", name: "Outreach round 1", start: addDays(T, 9), end: addDays(T, 16), progress: 0, blocks: [] },
];

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
export default function Planner({ initialData = null, onChange = null, accountSlot = null }) {
  const [todayStr, setTodayStr] = useState(today);     // live "today" so markers + progress advance without a refresh
  const T = todayStr;
  useEffect(() => { const id = setInterval(() => setTodayStr(today()), 60000); return () => clearInterval(id); }, []);
  const [projects, setProjects] = useState(() => initialData?.projects ?? load(LS_PROJECTS, seedProjects));
  const [tasks, setTasks] = useState(() => initialData?.tasks ?? load(LS_TASKS, seedTasks));
  const [collapsed, setCollapsed] = useState({});
  const [selected, setSelected] = useState(null);     // task id (drawer)
  const [view, setView] = useState("timeline");        // timeline | day
  const [dayDate, setDayDate] = useState(T);
  const [dayWidth, setDayWidth] = useState(34);
  const [editing, setEditing] = useState(null);        // {type, id} inline rename
  const [toast, setToast] = useState(null);             // {key, text} completion reward
  const [coinDrop, setCoinDrop] = useState(null);       // animation key
  const [sparkle, setSparkle] = useState(null);         // level-up animation key
  const prevLevel = useRef(1);
  const timelineRef = useRef(null);
  const [confirmDel, setConfirmDel] = useState(null);   // project id pending delete
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!coinDrop) return;
    const id = setTimeout(() => setCoinDrop(null), 850);
    return () => clearTimeout(id);
  }, [coinDrop]);
  useEffect(() => {
    if (!sparkle) return;
    const id = setTimeout(() => setSparkle(null), 1100);
    return () => clearTimeout(id);
  }, [sparkle]);
  useEffect(() => { save(LS_PROJECTS, projects); }, [projects]);
  useEffect(() => { save(LS_TASKS, tasks); }, [tasks]);
  useEffect(() => { if (onChange) onChange({ projects, tasks }); }, [projects, tasks]);

  const color = (pid) => projects.find((p) => p.id === pid)?.color || "#888";

  /* timeline window */
  const { origin, totalDays } = useMemo(() => {
    let min = T, max = addDays(T, 14);
    tasks.forEach((t) => { if (t.start < min) min = t.start; if (t.end > max) max = t.end; });
    const o = addDays(min, -3);
    return { origin: o, totalDays: diffDays(addDays(max, 6), o) };
  }, [tasks]);
  const xOf = (d) => diffDays(d, origin) * dayWidth;
  const trackW = totalDays * dayWidth;

  // open the timeline scrolled so TODAY sits just in from the left (re-runs on zoom / view switch)
  useEffect(() => {
    if (view !== "timeline" || !timelineRef.current) return;
    const todayX = xOf(T) + dayWidth / 2;
    timelineRef.current.scrollLeft = Math.max(0, todayX - 110);
  }, [dayWidth, view]);

  /* project rollups */
  const rollups = useMemo(() => {
    const m = {};
    projects.forEach((p) => {
      const ts = tasks.filter((t) => t.pid === p.id);
      if (!ts.length) { m[p.id] = null; return; }
      let start = ts[0].start, end = ts[0].end, num = 0, den = 0;
      ts.forEach((t) => {
        if (t.start < start) start = t.start;
        if (t.end > end) end = t.end;
        const dur = Math.max(1, diffDays(t.end, t.start));
        num += t.progress * dur; den += dur;
      });
      const progress = Math.round(num / den);
      const span = Math.max(1, diffDays(end, start));
      const elapsed = Math.min(span, Math.max(0, diffDays(T, start)));
      const expected = Math.round((elapsed / span) * 100);
      m[p.id] = { start, end, progress, expected, behind: progress < expected - 12 };
    });
    return m;
  }, [projects, tasks]);

  /* ---- "On-Task" score + XP/level (the incentive layer) ---- */
  const stats = useMemo(() => {
    let shortfallNum = 0, weight = 0, xp = 0, done = 0;
    tasks.forEach((t) => {
      const dur = Math.max(1, diffDays(t.end, t.start));
      if (t.done) { xp += taskXP(t); done++; }
      const elapsed = Math.min(dur, Math.max(0, diffDays(T, t.start)));
      const expected = (elapsed / dur) * 100;     // where you *should* be
      if (expected > 0) {                          // only count started tasks
        shortfallNum += Math.max(0, expected - t.progress) * dur;
        weight += dur;
      }
    });
    const onTask = weight ? Math.round(100 - shortfallNum / weight) : 100;
    const tone = onTask >= 85 ? "#2dd4bf" : onTask >= 60 ? "#f0b429" : "#fb7185";
    const label = onTask >= 85 ? "On track" : onTask >= 60 ? "Slipping" : "Behind";
    return { onTask, tone, label, xp, level: Math.floor(xp / LEVEL) + 1, intoLevel: xp % LEVEL, done, total: tasks.length };
  }, [tasks]);

  useEffect(() => {
    if (stats.level > prevLevel.current) setSparkle(Date.now());
    prevLevel.current = stats.level;
  }, [stats.level]);

  const drag = useRef(null);
  useEffect(() => {
    const move = (e) => {
      const d = drag.current; if (!d) return;
      const delta = Math.round((e.clientX - d.startX) / dayWidth);
      setTasks((prev) => prev.map((t) => {
        if (t.id !== d.id) return t;
        if (d.mode === "move") return { ...t, start: addDays(d.s0, delta), end: addDays(d.e0, delta) };
        // resize end
        let end = addDays(d.e0, delta);
        if (diffDays(end, t.start) < 1) end = addDays(t.start, 1);
        return { ...t, end };
      }));
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dayWidth]);
  const startDrag = (e, task, mode) => {
    e.stopPropagation();
    drag.current = { id: task.id, mode, startX: e.clientX, s0: task.start, e0: task.end };
  };

  /* ---- mutations ---- */
  const toggle = (pid) => setCollapsed((c) => ({ ...c, [pid]: !c[pid] }));
  const addProject = () => {
    const id = "p" + Date.now();
    setProjects((p) => [...p, { id, name: "New Project", color: PALETTE[p.length % PALETTE.length] }]);
    setEditing({ type: "project", id });
  };
  const addTask = (pid) => {
    const id = "t" + Date.now();
    setTasks((t) => [...t, { id, pid, name: "New task", start: T, end: addDays(T, 3), progress: 0, blocks: [] }]);
    setCollapsed((c) => ({ ...c, [pid]: false }));
    setSelected(id);
  };
  const patchTask = (id, patch) => {
    const cur = tasks.find((x) => x.id === id);
    let extra = {};
    if (cur) {
      const wasDone = cur.progress >= 100;
      const willDone = (patch.progress ?? cur.progress) >= 100;
      if (willDone && !wasDone) {
        extra = { done: true, completedAt: T };
        const xp = taskXP({ ...cur, ...patch, ...extra });
        setToast({ key: Date.now(), text: `${(patch.name ?? cur.name)} complete   +${xp} XP` });
        setCoinDrop(Date.now());
      } else if (!willDone && wasDone) {
        extra = { done: false, completedAt: null };
      }
    }
    setTasks((t) => t.map((x) => x.id === id ? { ...x, ...patch, ...extra } : x));
  };
  const delTask = (id) => { setTasks((t) => t.filter((x) => x.id !== id)); if (selected === id) setSelected(null); };
  const renameProject = (id, name) => setProjects((p) => p.map((x) => x.id === id ? { ...x, name } : x));
  const delProject = (id) => setConfirmDel(id);
  const doDelProject = (id) => {
    setTasks((t) => t.filter((x) => x.pid !== id));
    setProjects((pr) => pr.filter((x) => x.id !== id));
    if (sel && sel.pid === id) setSelected(null);
    setConfirmDel(null);
  };

  const sel = tasks.find((t) => t.id === selected);

  /* ordered rows for rendering */
  const rows = [];
  projects.forEach((p) => {
    rows.push({ type: "project", p });
    if (!collapsed[p.id]) tasks.filter((t) => t.pid === p.id).forEach((t) => rows.push({ type: "task", t, p }));
  });

  const ROW = 38;

  return (
    <div className="grid-root" style={S.root}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={S.logo}>GRID</span>
          <span style={S.tagline}>project × time planner</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={S.seg}>
            <button style={S.segBtn(view === "timeline")} onClick={() => setView("timeline")}><BarChart3 size={13} /> Timeline</button>
            <button style={S.segBtn(view === "day")} onClick={() => setView("day")}><Clock size={13} /> Day</button>
          </div>
          {view === "timeline" && (
            <div style={S.seg}>
              {[24, 34, 48].map((w) => (
                <button key={w} style={S.segBtn(dayWidth === w)} onClick={() => setDayWidth(w)}>{w === 24 ? "M" : w === 34 ? "W" : "D"}</button>
              ))}
            </div>
          )}
          <button style={S.resetBtn} title="Reset to sample data" onClick={() => setConfirmReset(true)}><RotateCcw size={13} /></button>
          {accountSlot}
        </div>
      </div>

      {/* Dashboard — On-Task plant + completion coin jar */}
      <div style={S.dash}>
        <div style={S.stat}>
          <Plant score={stats.onTask} />
          <div>
            <div style={S.statLabel}><Target size={11} /> ON-TASK</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: stats.tone }}>{stats.label}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)", marginTop: 1 }}>{stats.onTask}<span style={{ color: "var(--faint)" }}> / 100</span></div>
          </div>
        </div>

        <div style={S.statDiv} />

        <div style={{ ...S.stat, flex: 1, maxWidth: 300 }}>
          <CoinJar ratio={stats.intoLevel / LEVEL} dropKey={coinDrop} sparkleKey={sparkle} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={S.statLabel}><Zap size={11} /> LEVEL {stats.level}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>{stats.xp} XP</span>
            </div>
            <div style={{ height: 7, background: "var(--line2)", borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(stats.intoLevel / LEVEL) * 100}%`, background: "linear-gradient(90deg,#ffd56b,#e0992b)", transition: "width .5s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 3 }}>{LEVEL - stats.intoLevel} XP to level {stats.level + 1}</div>
          </div>
        </div>

        <div style={S.statDiv} />

        <div style={S.stat}>
          <CheckCircle2 size={20} color="#2dd4bf" style={{ flex: "none" }} />
          <div>
            <div style={S.statLabel}>COMPLETED</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--text)" }}>{stats.done}<span style={{ color: "var(--faint)", fontSize: 12 }}> / {stats.total}</span></div>
          </div>
        </div>
      </div>

      {view === "timeline" ? (
        /* ============================ TIMELINE ============================ */
        <div style={S.body}>
          {/* left labels */}
          <div style={S.leftPane}>
            <div style={{ ...S.axisH, paddingLeft: 14, color: "var(--dim)", fontSize: 11, letterSpacing: ".08em", position: "sticky", top: 0, zIndex: 6, background: "var(--panel)" }}>PROJECTS</div>
            {rows.map((r, i) => r.type === "project" ? (
              <div key={r.p.id} className="row-in" style={{ ...S.lbl, height: ROW, background: "var(--panel2)", animationDelay: `${i * 28}ms` }}>
                <button style={S.chev} onClick={() => toggle(r.p.id)}>
                  {collapsed[r.p.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: r.p.color, flex: "none" }} />
                {editing && editing.type === "project" && editing.id === r.p.id ? (
                  <input autoFocus defaultValue={r.p.name} style={S.renameInput}
                    onBlur={(e) => { renameProject(r.p.id, e.target.value || "Untitled"); setEditing(null); }}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                ) : (
                  <span style={S.pName} onDoubleClick={() => setEditing({ type: "project", id: r.p.id })}>{r.p.name}</span>
                )}
                {rollups[r.p.id]?.behind && <AlertTriangle size={12} color="#fb7185" />}
                <span style={S.pPct}>{rollups[r.p.id]?.progress ?? 0}%</span>
                <button style={S.addMini} title="Add task" onClick={() => addTask(r.p.id)}><Plus size={13} /></button>
                <button style={S.addMini} title="Delete project" onClick={() => delProject(r.p.id)}><Trash2 size={12} /></button>
              </div>
            ) : (
              <div key={r.t.id} className="row-in lblrow" style={{ ...S.lbl, height: ROW, paddingLeft: 34, cursor: "pointer", background: selected === r.t.id ? "var(--sel)" : "transparent", animationDelay: `${i * 28}ms` }}
                onClick={() => setSelected(r.t.id)}>
                <span style={{ ...S.tName }}>{r.t.name}</span>
                <span style={S.tPct}>{r.t.progress}%</span>
              </div>
            ))}
            <div style={{ ...S.lbl, height: ROW }}>
              <button style={S.addProj} onClick={addProject}><Plus size={13} /> Project</button>
            </div>
          </div>

          {/* right scrollable timeline */}
          <div ref={timelineRef} style={S.rightPane}>
            <div style={{ width: trackW, position: "relative" }}>
              {/* axis */}
              <div style={{ ...S.axisH, position: "sticky", top: 0, zIndex: 6, background: "var(--bg)" }}>
                {Array.from({ length: totalDays }).map((_, i) => {
                  const d = parse(addDays(origin, i)); const wknd = d.getDay() === 0 || d.getDay() === 6;
                  const first = d.getDate() === 1 || i === 0;
                  return (
                    <div key={i} style={{ position: "absolute", left: i * dayWidth, top: 0, width: dayWidth, height: "100%", borderLeft: "1px solid var(--line)", background: wknd ? "var(--wknd)" : "transparent", boxSizing: "border-box" }}>
                      {first && <div style={S.month}>{MONTHS[d.getMonth()]}</div>}
                      <div style={{ ...S.dayNum, color: wknd ? "var(--faint)" : "var(--dim)" }}>{DOW[d.getDay()]}</div>
                      <div style={{ ...S.dayNum, top: 22, fontWeight: 600, color: "var(--text)" }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {/* grid + bars */}
              <div style={{ position: "relative" }}>
                {/* vertical day grid */}
                {Array.from({ length: totalDays }).map((_, i) => {
                  const d = parse(addDays(origin, i)); const wknd = d.getDay() === 0 || d.getDay() === 6;
                  return <div key={i} style={{ position: "absolute", left: i * dayWidth, top: 0, bottom: 0, width: dayWidth, borderLeft: "1px solid var(--line)", background: wknd ? "var(--wknd)" : "transparent", boxSizing: "border-box" }} />;
                })}

                {/* now line */}
                <div style={{ position: "absolute", left: xOf(T) + dayWidth / 2, top: 0, bottom: 0, width: 2, background: "#fb7185", zIndex: 5, pointerEvents: "none" }}>
                  <div style={S.nowTag} className="now-pulse">TODAY</div>
                </div>

                {/* rows */}
                {rows.map((r) => r.type === "project" ? (
                  <div key={r.p.id} style={{ height: ROW, position: "relative" }}>
                    {rollups[r.p.id] && (() => {
                      const ru = rollups[r.p.id];
                      const left = xOf(ru.start), w = Math.max(dayWidth, xOf(ru.end) - xOf(ru.start) + dayWidth);
                      return (
                        <div style={{ position: "absolute", left, top: 11, width: w, height: 16, borderRadius: 5, background: "var(--rollBg)", border: "1px solid var(--line2)", overflow: "hidden", boxSizing: "border-box" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${ru.progress}%`, background: ru.behind ? "rgba(251,113,133,.32)" : `${r.p.color}33`, transition: "width .5s ease" }} />
                          {/* expected marker */}
                          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${ru.expected}%`, width: 2, background: "var(--faint)" }} />
                          <span style={{ position: "absolute", right: 6, top: 1, fontSize: 10, fontFamily: "var(--mono)", color: "var(--dim)" }}>{ru.progress}%</span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (() => {
                  const left = xOf(r.t.start), w = Math.max(dayWidth, xOf(r.t.end) - xOf(r.t.start) + dayWidth);
                  const c = r.p.color;
                  return (
                    <div key={r.t.id} style={{ height: ROW, position: "relative" }}>
                      <div className="taskbar" onPointerDown={(e) => startDrag(e, r.t, "move")} onClick={() => setSelected(r.t.id)}
                        style={{ position: "absolute", left, top: 8, width: w, height: 22, borderRadius: 6, background: `${c}1f`, border: `1px solid ${selected === r.t.id ? c : c + "66"}`, boxShadow: selected === r.t.id ? `0 0 0 1px ${c}` : "none", cursor: "grab", overflow: "hidden", boxSizing: "border-box", display: "flex", alignItems: "center", opacity: r.t.done ? 0.78 : 1 }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${r.t.progress}%`, background: `${c}3a`, transition: "width .5s ease" }} />
                        {r.t.done && <span key={`chk-${r.t.id}`} className="pop-in" style={{ position: "relative", marginLeft: 6, display: "flex", flex: "none" }}><Check size={12} color={c} /></span>}
                        <span style={{ position: "relative", padding: "0 8px", fontSize: 11, color: "var(--text)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", textDecoration: r.t.done ? "line-through" : "none", opacity: r.t.done ? 0.85 : 1 }}>{r.t.name}</span>
                        <div onPointerDown={(e) => startDrag(e, r.t, "resize")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize" }} />
                      </div>
                    </div>
                  );
                })())}
                <div style={{ height: ROW }} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================ DAY ============================ */
        <DayView {...{ dayDate, setDayDate, tasks, setTasks, color, projects }} />
      )}

      {/* Task drawer */}
      {sel && view === "timeline" && (
        <div style={S.drawer}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 11, letterSpacing: ".1em", color: "var(--dim)" }}>TASK</span>
            <button style={S.iconBtn} onClick={() => setSelected(null)}><X size={15} /></button>
          </div>
          <input value={sel.name} onChange={(e) => patchTask(sel.id, { name: e.target.value })} style={S.field} />
          <label style={S.flabel}>Project</label>
          <select value={sel.pid} onChange={(e) => patchTask(sel.id, { pid: e.target.value })} style={S.field}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.flabel}>Start</label>
              <input type="date" value={sel.start} onChange={(e) => patchTask(sel.id, { start: e.target.value })} style={S.field} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.flabel}>End</label>
              <input type="date" value={sel.end} onChange={(e) => patchTask(sel.id, { end: e.target.value < sel.start ? sel.start : e.target.value })} style={S.field} />
            </div>
          </div>
          <label style={S.flabel}>Progress — {sel.progress}%</label>
          <input type="range" min={0} max={100} value={sel.progress} onChange={(e) => patchTask(sel.id, { progress: +e.target.value })} style={{ width: "100%", accentColor: color(sel.pid) }} />
          {sel.done ? (
            <button style={S.doneBtn} onClick={() => patchTask(sel.id, { progress: 90 })}><Check size={14} /> Completed — reopen</button>
          ) : (
            <button style={S.completeBtn} onClick={() => patchTask(sel.id, { progress: 100 })}>
              <CheckCircle2 size={14} /> Mark complete
              <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, opacity: .8 }}>
                +{taskXP({ ...sel, completedAt: T })} XP{T <= sel.end ? "  (on time ×1.5)" : ""}
              </span>
            </button>
          )}
          <button style={S.delBtn} onClick={() => delTask(sel.id)}><Trash2 size={13} /> Delete task</button>
        </div>
      )}

      {/* Completion reward toast */}
      {toast && (
        <div key={toast.key} style={S.toast}>
          <CheckCircle2 size={15} color="#2dd4bf" /> {toast.text}
        </div>
      )}

      {/* Delete-project confirmation */}
      {confirmDel && (() => {
        const p = projects.find((x) => x.id === confirmDel);
        const n = tasks.filter((t) => t.pid === confirmDel).length;
        return (
          <div style={S.overlay} onClick={() => setConfirmDel(null)}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={17} color="#fb7185" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Delete project?</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--dim)", margin: "0 0 18px", lineHeight: 1.5 }}>
                "{p?.name}"{n ? ` and its ${n} task${n > 1 ? "s" : ""}` : ""} will be permanently removed.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={S.btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
                <button style={S.btnDanger} onClick={() => doDelProject(confirmDel)}><Trash2 size={13} /> Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reset confirmation */}
      {confirmReset && (
        <div style={S.overlay} onClick={() => setConfirmReset(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <RotateCcw size={16} color="#f0b429" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Reset to sample data?</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--dim)", margin: "0 0 18px", lineHeight: 1.5 }}>
              This clears all your saved projects, tasks, and XP and restores the original demo.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btnGhost} onClick={() => setConfirmReset(false)}>Cancel</button>
              <button style={S.btnDanger} onClick={() => { setProjects(seedProjects); setTasks(seedTasks); setSelected(null); setConfirmReset(false); }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Day view (hourly time-block scheduler)                             */
/* ------------------------------------------------------------------ */
function DayView({ dayDate, setDayDate, tasks, setTasks, color, projects }) {
  const H0 = 0, H1 = 24, HPX = 46;
  const [active, setActive] = useState(null); // task id selected for scheduling
  const drag = useRef(null);
  const scrollRef = useRef(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  // open scrolled to the current hour (today) or 8am, so the empty night hours aren't in the way
  useEffect(() => {
    const hr = dayDate === today() ? new Date().getHours() : 8;
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (hr - H0) * HPX - 24);
  }, [dayDate]);

  const dayTasks = tasks.filter((t) => t.start <= dayDate && t.end >= dayDate);
  const blocks = [];
  tasks.forEach((t) => t.blocks.forEach((b) => { if (b.date === dayDate) blocks.push({ ...b, tid: t.id, name: t.name, pid: t.pid }); }));

  const setBlocks = (tid, fn) => setTasks((prev) => prev.map((t) => t.id === tid ? { ...t, blocks: fn(t.blocks) } : t));
  const addBlock = (hour) => {
    if (!active) return;
    const id = "b" + Date.now();
    setBlocks(active, (bs) => [...bs, { id, date: dayDate, s: hour, e: Math.min(H1, hour + 1) }]);
  };
  const delBlock = (tid, id) => setBlocks(tid, (bs) => bs.filter((b) => b.id !== id));

  useEffect(() => {
    const move = (e) => {
      const d = drag.current; if (!d) return;
      const dh = Math.round(((e.clientY - d.startY) / HPX) * 2) / 2;
      setBlocks(d.tid, (bs) => bs.map((b) => {
        if (b.id !== d.id) return b;
        if (d.mode === "move") { let s = Math.max(H0, Math.min(H1 - (d.e0 - d.s0), d.s0 + dh)); return { ...b, s, e: s + (d.e0 - d.s0) }; }
        return { ...b, e: Math.max(b.s + 0.5, Math.min(H1, d.e0 + dh)) };
      }));
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);
  const startDrag = (e, b, mode) => { e.stopPropagation(); drag.current = { id: b.id, tid: b.tid, mode, startY: e.clientY, s0: b.s, e0: b.e }; };

  const d = parse(dayDate);
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* task picker */}
      <div style={{ width: 250, borderRight: "1px solid var(--line)", padding: 14, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button style={S.iconBtn} onClick={() => setDayDate(addDays(dayDate, -1))}><ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /></button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>{d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
          </div>
          <button style={S.iconBtn} onClick={() => setDayDate(addDays(dayDate, 1))}><ChevronRight size={14} /></button>
        </div>
        <div style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--dim)", marginBottom: 8 }}>ACTIVE TASKS — tap to schedule</div>
        {dayTasks.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>No tasks span this day.</div>}
        {dayTasks.map((t) => (
          <button key={t.id} onClick={() => setActive(active === t.id ? null : t.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", marginBottom: 6, borderRadius: 7, border: `1px solid ${active === t.id ? color(t.pid) : "var(--line2)"}`, background: active === t.id ? `${color(t.pid)}1f` : "var(--panel2)", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: color(t.pid), flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
          </button>
        ))}
        {active && <div style={{ marginTop: 10, fontSize: 11, color: "var(--dim)" }}>↳ click an hour slot to drop a block</div>}
      </div>

      {/* hourly grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        <div style={{ position: "relative", paddingLeft: 54 }}>
          {Array.from({ length: H1 - H0 }).map((_, i) => {
            const h = H0 + i;
            const isNow = dayDate === today() && now.getHours() === h;
            return (
              <div key={h} onClick={() => addBlock(h)}
                style={{ height: HPX, borderTop: "1px solid var(--line)", position: "relative", cursor: active ? "copy" : "default", background: isNow ? "rgba(255,77,109,.08)" : "transparent" }}>
                <span style={{ position: "absolute", left: -50, top: -7, width: 44, textAlign: "right", fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)" }}>{fmtHour(h)}</span>
              </div>
            );
          })}
          {/* blocks */}
          {blocks.map((b) => {
            const c = color(b.pid);
            return (
              <div key={b.id} onPointerDown={(e) => startDrag(e, b, "move")}
                style={{ position: "absolute", left: 58, right: 14, top: (b.s - H0) * HPX, height: (b.e - b.s) * HPX, background: `${c}26`, border: `1px solid ${c}`, borderRadius: 7, padding: "4px 8px", boxSizing: "border-box", cursor: "grab", overflow: "hidden" }}>
                <div style={{ fontSize: 11, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)" }}>{fmtHour(b.s)} – {fmtHour(b.e)}</div>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => delBlock(b.tid, b.id)} style={{ position: "absolute", top: 3, right: 3, background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 2 }}><X size={12} /></button>
                <div onPointerDown={(e) => startDrag(e, b, "resize")} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 7, cursor: "ns-resize" }} />
              </div>
            );
          })}
          {dayDate === today() && (() => {
            const nh = now.getHours() + now.getMinutes() / 60;
            return (
              <div style={{ position: "absolute", left: 54, right: 14, top: (nh - H0) * HPX, height: 0, zIndex: 7, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: -1, height: 2, background: "#ff4d6d", boxShadow: "0 0 8px rgba(255,77,109,.75)" }} />
                <div style={{ position: "absolute", left: -5, top: -5, width: 10, height: 10, borderRadius: 10, background: "#ff4d6d", boxShadow: "0 0 9px rgba(255,77,109,.95)" }} />
                <span style={{ position: "absolute", left: -52, top: -8, fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: "#fff", background: "#ff4d6d", borderRadius: 4, padding: "1px 5px" }}>{fmtHour(nh)}</span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#0e1014; --panel:#15181e; --panel2:#1a1e26; --sel:#1f2530;
  --line:#22262e; --line2:#2e343d; --wknd:rgba(255,255,255,.018);
  --rollBg:#13161c; --text:#e7eaef; --dim:#8b94a3; --faint:#5b6472;
  --mono:'JetBrains Mono',monospace;
}
*{font-family:'Hanken Grotesk',sans-serif;}
html,body{margin:0;padding:0;height:100%;}
.grid-root{height:100vh;height:100dvh;}
input[type=date]{color-scheme:dark;}
::-webkit-scrollbar{height:9px;width:9px;}
::-webkit-scrollbar-thumb{background:#2e343d;border-radius:6px;}
::-webkit-scrollbar-track{background:transparent;}
.noscrollbar::-webkit-scrollbar{width:0;height:0;}
.noscrollbar{scrollbar-width:none;-ms-overflow-style:none;}
@keyframes pop{from{opacity:0;transform:translateX(-50%) translateY(10px) scale(.96);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
.sway{animation:sway 4.5s ease-in-out infinite;}
@keyframes sway{0%,100%{transform:rotate(-2.2deg);}50%{transform:rotate(2.2deg);}}
.coindrop{animation:drop .8s cubic-bezier(.5,0,.7,1) forwards;}
@keyframes drop{0%{transform:translateY(0);opacity:0;}25%{opacity:1;}80%{transform:translateY(40px);}90%{transform:translateY(35px);}100%{transform:translateY(40px);opacity:0;}}
.spark{transform-box:fill-box;transform-origin:center;animation:spark 1s ease-out forwards;}
@keyframes spark{0%{opacity:0;transform:scale(.2) rotate(0deg);}40%{opacity:1;transform:scale(1.3) rotate(40deg);}100%{opacity:0;transform:scale(.4) rotate(80deg);}}
.fade-in{animation:fadein .6s ease both;}
@keyframes fadein{from{opacity:0;}to{opacity:1;}}
.pop-in{animation:popin .42s cubic-bezier(.2,1.5,.4,1) both;}
@keyframes popin{0%{transform:scale(0) rotate(-30deg);}100%{transform:scale(1) rotate(0deg);}}
.row-in{animation:rowin .45s ease both;}
@keyframes rowin{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:translateY(0);}}
.now-pulse{animation:nowpulse 2.4s ease-in-out infinite;}
@keyframes nowpulse{0%,100%{opacity:.5;}50%{opacity:1;}}
.taskbar{transition:filter .16s ease,transform .16s ease,box-shadow .16s ease;}
.taskbar:hover{filter:brightness(1.15);transform:translateY(-1px);}
.lblrow:hover{background:var(--sel)!important;}
button{transition:filter .15s ease,background .15s ease;}
button:hover{filter:brightness(1.18);}
`;
const S = {
  root: { display: "flex", flexDirection: "column", position: "relative", background: "var(--bg)", color: "var(--text)", overflow: "hidden", fontSize: 13 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--panel)" },
  logo: { fontFamily: "var(--mono)", fontWeight: 500, fontSize: 17, letterSpacing: ".22em", color: "var(--text)" },
  tagline: { fontSize: 12, color: "var(--faint)" },
  seg: { display: "flex", background: "var(--panel2)", borderRadius: 8, padding: 3, border: "1px solid var(--line)" },
  segBtn: (on) => ({ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", border: "none", borderRadius: 6, background: on ? "var(--line2)" : "transparent", color: on ? "var(--text)" : "var(--dim)", cursor: "pointer", fontSize: 12, fontWeight: 500 }),
  body: { display: "flex", flex: 1, minHeight: 0 },
  leftPane: { width: 248, flex: "none", borderRight: "1px solid var(--line)", overflowY: "auto", overflowX: "hidden", background: "var(--panel)" },
  rightPane: { flex: 1, overflowX: "auto", overflowY: "auto" },
  axisH: { height: 42, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-end" },
  month: { position: "absolute", top: 3, left: 4, fontSize: 10, fontFamily: "var(--mono)", color: "var(--dim)", whiteSpace: "nowrap" },
  dayNum: { position: "absolute", top: 10, left: 0, right: 0, textAlign: "center", fontSize: 9, fontFamily: "var(--mono)" },
  lbl: { display: "flex", alignItems: "center", gap: 7, padding: "0 12px", borderBottom: "1px solid var(--line)", boxSizing: "border-box" },
  chev: { background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 0, display: "flex" },
  pName: { fontSize: 13, fontWeight: 600, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pPct: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" },
  tName: { fontSize: 12.5, color: "var(--dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tPct: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)" },
  addMini: { background: "none", border: "none", color: "var(--faint)", cursor: "pointer", padding: 2, display: "flex" },
  addProj: { display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px dashed var(--line2)", borderRadius: 6, color: "var(--dim)", cursor: "pointer", padding: "5px 10px", fontSize: 12 },
  renameInput: { flex: 1, background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: 5, color: "var(--text)", padding: "3px 6px", fontSize: 13, outline: "none" },
  nowTag: { position: "absolute", top: -38, left: -18, fontSize: 8, fontFamily: "var(--mono)", color: "#fb7185", letterSpacing: ".1em" },
  drawer: { position: "absolute", right: 0, top: 0, bottom: 0, width: 300, background: "var(--panel)", borderLeft: "1px solid var(--line2)", padding: 18, boxShadow: "-12px 0 30px rgba(0,0,0,.4)", overflowY: "auto", zIndex: 30 },
  field: { width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: 7, color: "var(--text)", padding: "8px 10px", fontSize: 13, marginBottom: 14, outline: "none" },
  flabel: { display: "block", fontSize: 11, color: "var(--dim)", marginBottom: 5, letterSpacing: ".03em" },
  iconBtn: { background: "none", border: "none", color: "var(--dim)", cursor: "pointer", padding: 4, display: "flex" },
  delBtn: { display: "flex", alignItems: "center", gap: 6, marginTop: 22, background: "rgba(251,113,133,.1)", border: "1px solid rgba(251,113,133,.3)", borderRadius: 7, color: "#fb7185", cursor: "pointer", padding: "8px 12px", fontSize: 12, width: "100%", justifyContent: "center" },
  dash: { display: "flex", alignItems: "center", gap: 18, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--panel)" },
  stat: { display: "flex", alignItems: "center", gap: 11 },
  statLabel: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, letterSpacing: ".1em", color: "var(--dim)", marginBottom: 2 },
  statDiv: { width: 1, height: 34, background: "var(--line2)", flex: "none" },
  completeBtn: { display: "flex", alignItems: "center", gap: 7, marginTop: 18, width: "100%", boxSizing: "border-box", background: "rgba(45,212,191,.12)", border: "1px solid rgba(45,212,191,.4)", borderRadius: 8, color: "#2dd4bf", cursor: "pointer", padding: "10px 12px", fontSize: 13, fontWeight: 600 },
  doneBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, width: "100%", boxSizing: "border-box", background: "var(--panel2)", border: "1px solid var(--line2)", borderRadius: 8, color: "var(--dim)", cursor: "pointer", padding: "10px 12px", fontSize: 12 },
  toast: { position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, background: "#11251f", border: "1px solid rgba(45,212,191,.45)", color: "var(--text)", padding: "11px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "0 10px 34px rgba(0,0,0,.5)", zIndex: 40, animation: "pop .35s cubic-bezier(.2,1.4,.4,1)" },
  overlay: { position: "absolute", inset: 0, background: "rgba(6,8,11,.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, animation: "fadein .15s ease both" },
  modal: { width: 320, background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: 12, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.55)" },
  btnGhost: { background: "var(--panel2)", border: "1px solid var(--line2)", borderRadius: 7, color: "var(--text)", cursor: "pointer", padding: "8px 16px", fontSize: 13 },
  btnDanger: { display: "flex", alignItems: "center", gap: 6, background: "#fb7185", border: "1px solid #fb7185", borderRadius: 7, color: "#1a0d10", fontWeight: 600, cursor: "pointer", padding: "8px 16px", fontSize: 13 },
  resetBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--dim)", cursor: "pointer", padding: "7px 9px" },
};
