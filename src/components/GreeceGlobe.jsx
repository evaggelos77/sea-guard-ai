import React, { useEffect, useMemo, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate } from "d3-geo";
import { Fish, Waves, AlertTriangle, Plus, Minus, RotateCcw, Satellite, BrainCircuit, Activity, Radar } from "lucide-react";
import medmap from "../data/medmap.json";
import { INVASION_FLOWS, INVASION_ENTRY } from "../data/migration.js";

const W = 520;
const H = 460;
const CX = W / 2;
const CY = H / 2;
const BASE = 2500; // εστίαση στην Ελλάδα (υδρόγειος zoom)
const GREECE_CENTER = [24.0, 38.6]; // [lon, lat]
const ROT = [-GREECE_CENTER[0], -GREECE_CENTER[1]]; // σταθερή προβολή — η Ελλάδα ΔΕΝ κουνιέται

const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Κατηγορίες κινδύνου (παλέτα Αιγαίου)
function riskNode(risk) {
  if (risk >= 82) return { color: "#E03A4E", on: "#fff", label: "Κρίσιμος" };
  if (risk >= 66) return { color: "#F07A2E", on: "#2a1400", label: "Υψηλός" };
  if (risk >= 48) return { color: "#F2C744", on: "#3a2c00", label: "Μέτριος" };
  if (risk >= 30) return { color: "#5FB37A", on: "#04231c", label: "Χαμηλός-μέτριος" };
  return { color: "#36C5A8", on: "#04231c", label: "Χαμηλός" };
}

const greeceFeature = medmap.features.find((f) => f.name === "Greece");
const contextFeatures = medmap.features.filter((f) => f.name !== "Greece");

const lerp = (a, b, k) => a + (b - a) * k;

export default function GreeceGlobe({ zones = [], selectedZone, onSelectZone, realPoints = [] }) {
  const [view, setView] = useState({ rot: ROT, scale: BASE }); // controlled focus — όχι free drag
  const [hoverId, setHoverId] = useState(null);
  const [showGbif, setShowGbif] = useState(true);
  const [showFlows, setShowFlows] = useState(true);
  const rafRef = useRef(0);
  const toRef = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const firstFocus = useRef(true);

  // Ομαλή εστίαση (zoom + κεντράρισμα) στην επιλεγμένη περιοχή — controlled, χωρίς wobble.
  // rAF για ομαλότητα + setTimeout fallback ώστε να φτάνει σίγουρα στον στόχο
  // (ακόμη κι αν το rAF είναι throttled, π.χ. ανενεργή καρτέλα).
  const animateTo = (targetRot, targetScale) => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(toRef.current);
    const start = viewRef.current;
    const target = { rot: targetRot, scale: targetScale };
    let frame = 0;
    const FRAMES = 26;
    const tick = () => {
      frame += 1;
      const t = frame / FRAMES;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOut
      setView({
        rot: [lerp(start.rot[0], target.rot[0], e), lerp(start.rot[1], target.rot[1], e)],
        scale: lerp(start.scale, target.scale, e),
      });
      if (frame < FRAMES) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    toRef.current = setTimeout(() => {
      cancelAnimationFrame(rafRef.current);
      setView(target);
    }, 650);
  };

  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    if (selectedZone?.coords) {
      animateTo([-selectedZone.coords[1], -selectedZone.coords[0]], BASE * 1.85);
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(toRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZone?.id, selectedZone?.coords?.[0], selectedZone?.coords?.[1]]);

  const projection = useMemo(
    () => geoOrthographic().translate([CX, CY]).scale(view.scale).rotate([view.rot[0], view.rot[1]]).clipAngle(90),
    [view]
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const center = [-view.rot[0], -view.rot[1]];
  const visible = (lon, lat) => geoDistance([lon, lat], center) < Math.PI / 2 - 0.01;
  const project = (lon, lat) => {
    if (!visible(lon, lat)) return null;
    const p = projection([lon, lat]);
    return p ? [p[0], p[1]] : null;
  };

  const greecePath = useMemo(() => path(greeceFeature.geometry), [path]);
  const contextPaths = useMemo(() => contextFeatures.map((f) => path(f.geometry)), [path]);
  const gratPath = useMemo(() => path(geoGraticule10()), [path]);

  const corridors = useMemo(
    () =>
      INVASION_FLOWS.map((f) => ({
        ...f,
        d: path({ type: "LineString", coordinates: f.waypoints }),
        origin: project(f.waypoints[0][0], f.waypoints[0][1]),
      })),
    [path]
  );
  const entryP = project(INVASION_ENTRY.lon, INVASION_ENTRY.lat);

  const r = view.scale / BASE; // marker scale factor
  const dragging = false; // ο χάρτης είναι σταθερός — δεν περιστρέφεται ελεύθερα

  const zoom = (f) => setView((v) => ({ ...v, scale: clampN(v.scale * f, BASE * 0.7, BASE * 3.5) }));
  const reset = () => animateTo(ROT, BASE); // επιστροφή σε ΟΛΗ την Ελλάδα

  // Συγκεντρωτικοί δείκτες για τα μπαρόμετρα (δορυφόρος / AI)
  const metrics = useMemo(() => {
    const withRisk = zones.filter((z) => typeof z.risk === "number");
    const avg = withRisk.length ? Math.round(withRisk.reduce((s, z) => s + z.risk, 0) / withRisk.length) : 0;
    const high = withRisk.filter((z) => z.risk >= 66).length;
    const conf = selectedZone?.forecast?.confidence ?? 92;
    const sstZones = withRisk.filter((z) => z.sst != null);
    const sstCover = withRisk.length ? Math.round((sstZones.length / withRisk.length) * 100) : 0;
    return { avg, high, conf, sstCover, points: realPoints.length, total: withRisk.length };
  }, [zones, realPoints, selectedZone]);

  const projectedZones = useMemo(() => {
    const arr = zones.map((z) => ({
      ...z,
      p: z.coords ? project(z.coords[1], z.coords[0]) : null,
      rn: riskNode(z.risk),
    }));
    // Collision-avoidance: κοντινές ζώνες (Κως/Κάλυμνος κ.λπ.) απωθούνται ώστε
    // οι αριθμοί να μην επικαλύπτονται. Μετατόπιση λίγων px — γεωγραφικά αμελητέα.
    const minD = 27 * Math.min(1.5, r);
    const vis = arr.filter((z) => z.p);
    for (let it = 0; it < 16; it++) {
      let moved = false;
      for (let a = 0; a < vis.length; a++) {
        for (let b = a + 1; b < vis.length; b++) {
          const dx = vis[b].p[0] - vis[a].p[0];
          const dy = vis[b].p[1] - vis[a].p[1];
          const d = Math.hypot(dx, dy);
          if (d < minD && d > 0.01) {
            const push = (minD - d) / 2;
            const ux = dx / d;
            const uy = dy / d;
            vis[a].p = [vis[a].p[0] - ux * push, vis[a].p[1] - uy * push];
            vis[b].p = [vis[b].p[0] + ux * push, vis[b].p[1] + uy * push];
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return arr;
  }, [zones, projection, r]);
  const topZones = useMemo(() => [...zones].sort((a, b) => b.risk - a.risk).slice(0, 6), [zones]);
  const cardZone =
    projectedZones.find((z) => z.id === hoverId) ||
    projectedZones.find((z) => z.id === selectedZone?.id) ||
    projectedZones[0];

  return (
    <section className="invasion-map" aria-label="Χάρτης εισβολής λαγοκέφαλου">
      <a href="#im-side-content" className="sr-only sr-skip">Μετάβαση στις λεπτομέρειες κινδύνου</a>
      <p id="globe-help" className="sr-only">
        Χρησιμοποίησε το Tab για να μετακινηθείς στις ζώνες κινδύνου και Enter για επιλογή.
        Ο χάρτης είναι σταθερός· χρησιμοποίησε τα κουμπιά + και − για μεγέθυνση.
      </p>
      <div className="im-head">
        <div>
          <p className="im-eyebrow">Ζωντανός χάρτης · Live globe</p>
          <h2 className="im-title">Ελληνικές θάλασσες — εξάπλωση λαγοκέφαλου</h2>
          <p className="im-sub">3D υδρόγειος εστιασμένη στην Ελλάδα · πραγματικά δεδομένα</p>
        </div>
        <div className="im-toggles">
          <button type="button" className={`im-toggle ${showFlows ? "on" : ""}`} onClick={() => setShowFlows((v) => !v)} aria-pressed={showFlows}>
            <Fish size={15} /> Ροή εισβολής
          </button>
          <button type="button" className={`im-toggle ${showGbif ? "on" : ""}`} onClick={() => setShowGbif((v) => !v)} aria-pressed={showGbif}>
            <Waves size={15} /> Καταγραφές
          </button>
        </div>
      </div>

      <div className="im-grid">
        <div className="globe-wrap">
          <svg
            className="globe-svg is-static"
            viewBox={`0 0 ${W} ${H}`}
            role="application"
            aria-label="Τρισδιάστατη υδρόγειος εστιασμένη στις ελληνικές θάλασσες"
            aria-describedby="globe-help"
          >
            <defs>
              <radialGradient id="gg-ocean" cx="40%" cy="34%" r="78%">
                <stop offset="0%" stopColor="#10516a" />
                <stop offset="48%" stopColor="#083449" />
                <stop offset="100%" stopColor="#03101c" />
              </radialGradient>
              <radialGradient id="gg-atmo" cx="50%" cy="50%" r="50%">
                <stop offset="74%" stopColor="#35d7be" stopOpacity="0" />
                <stop offset="92%" stopColor="#35d7be" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#35d7be" stopOpacity="0" />
              </radialGradient>
              <marker id="gg-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
              </marker>
            </defs>

            {/* ατμόσφαιρα + σφαίρα ωκεανού */}
            <circle cx={CX} cy={CY} r={view.scale + 10} fill="url(#gg-atmo)" />
            <circle cx={CX} cy={CY} r={view.scale} fill="url(#gg-ocean)" stroke="rgba(126,255,232,0.32)" strokeWidth="1" />

            {gratPath && <path d={gratPath} className="globe-grat" />}

            {/* ξηρά: γειτονικές (αχνές) + Ελλάδα (φωτεινή) */}
            <g className="globe-land">
              {contextPaths.map((d, i) => (d ? <path key={i} d={d} className="gg-context" /> : null))}
              {greecePath && <path d={greecePath} className="gg-greece" />}
            </g>

            {/* διαδρομές εισβολής (great-circle τόξα) */}
            {showFlows &&
              corridors.map((c) =>
                c.d ? (
                  <g key={c.id} className="globe-corridor type-invasion" style={{ color: c.intensity >= 0.85 ? "#FF3D5E" : "#FF7A3D" }}>
                    <path d={c.d} className="globe-corridor-halo" />
                    <path d={c.d} className="globe-corridor-line" markerEnd="url(#gg-arrow)" />
                    {c.origin && <circle cx={c.origin[0]} cy={c.origin[1]} r={3.5} className="globe-corridor-origin" />}
                  </g>
                ) : null
              )}
            {showFlows && <FlowParticles projection={projection} corridors={INVASION_FLOWS} center={center} />}

            {/* είσοδος (Σουέζ) */}
            {showFlows && entryP && (
              <g transform={`translate(${entryP[0]} ${entryP[1]})`}>
                <circle r="12" fill="#FF3D5E" opacity="0.22" className="globe-ping" />
                <circle r="4.5" fill="#FF3D5E" stroke="#fff" strokeWidth="1.2" />
                <text x="0" y="-12" textAnchor="middle" fill="#ffd7df" fontSize="9" fontWeight="800">Σουέζ →</text>
              </g>
            )}

            {/* πραγματικές καταγραφές GBIF */}
            {showGbif && !dragging && (
              <g className="gg-gbif">
                {realPoints.map((pt, i) => {
                  const p = project(pt.lng, pt.lat);
                  if (!p) return null;
                  return <circle key={i} cx={p[0]} cy={p[1]} r={2.1} fill="#ff6fb0" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" className="species-dot is-invasive" />;
                })}
              </g>
            )}

            {/* ζώνες κινδύνου ως κόμβοι (αριθμός μέσα) */}
            {projectedZones.map((z) => {
              if (!z.p) return null;
              const sel = z.id === selectedZone?.id;
              const hov = z.id === hoverId;
              const rr = (sel || hov ? 13 : 11) * Math.min(1.5, r);
              return (
                <g
                  key={z.id}
                  className="globe-node"
                  transform={`translate(${z.p[0]} ${z.p[1]})`}
                  onClick={() => onSelectZone?.(z.id)}
                  onMouseEnter={() => setHoverId(z.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(z.id)}
                  onBlur={() => setHoverId(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${z.area}: κίνδυνος ${z.risk} στα 100, ${z.rn.label}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectZone?.(z.id);
                    }
                  }}
                >
                  {sel && <circle r={rr + 5} fill="none" stroke={z.rn.color} strokeWidth="1.4" className="globe-ping" />}
                  <circle r={rr} fill={z.rn.color} stroke="rgba(255,255,255,0.9)" strokeWidth={sel || hov ? 2.2 : 1.4} />
                  <text textAnchor="middle" dy={3.4 * Math.min(1.5, r)} fontSize={9 * Math.min(1.5, r)} fontWeight="800" fill={z.rn.on}>
                    {z.risk}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="map-controls" role="group" aria-label="Μεγέθυνση χάρτη">
            <button type="button" onClick={() => zoom(1.35)} aria-label="Μεγέθυνση"><Plus size={16} /></button>
            <button type="button" onClick={() => zoom(1 / 1.35)} aria-label="Σμίκρυνση"><Minus size={16} /></button>
            <button type="button" onClick={reset} aria-label="Επαναφορά μεγέθυνσης"><RotateCcw size={15} /></button>
          </div>
          {r > 1.05 && <div className="map-hint">Μεγέθυνση {r.toFixed(1)}×</div>}
        </div>

        <div className="im-gauges" aria-label="Δείκτες δορυφορικού AI">
          <GaugeRing value={metrics.conf} label="AI Confidence" sub="μοντέλο πρόβλεψης" color="#7fd4ff" icon={BrainCircuit} />
          <GaugeRing value={metrics.avg} label="Πίεση εισβολής" sub="μέσος κίνδυνος ζωνών" color="#F07A2E" icon={Activity} />
          <GaugeRing value={metrics.sstCover} label="Δορυφ. κάλυψη" sub={`SST σε ${metrics.total} ζώνες`} color="#36C5A8" icon={Satellite} orbit />
          <GaugeRing value={Math.min(100, metrics.points)} display={`${metrics.points}`} label="Καταγραφές" sub="ζωντανά GBIF" color="#ff6fb0" icon={Radar} />
        </div>

        <aside className="im-side" id="im-side-content">
          {cardZone && (
            <div className="im-card" style={{ borderColor: cardZone.rn.color }}>
              <p className="im-card-eyebrow">{hoverId ? "Δείχνεις" : "Επιλεγμένη ζώνη"}</p>
              <h3 className="im-card-title">{cardZone.area}</h3>
              <div className="im-card-risk">
                <span className="im-chip" style={{ background: cardZone.rn.color }}>{cardZone.rn.label}</span>
                <strong>{cardZone.risk}/100</strong>
              </div>
              <dl className="im-card-facts">
                <div>
                  <dt><Waves size={13} /> Θερμοκρασία</dt>
                  <dd>{cardZone.sst != null ? `${cardZone.sst.toFixed(1)}°C` : "—"}</dd>
                </div>
                <div>
                  <dt><Fish size={13} /> Καταγραφές 3ετίας</dt>
                  <dd>{cardZone.occRecent != null ? cardZone.occRecent : "—"}</dd>
                </div>
              </dl>
              <p className="im-card-note">{cardZone.recommendation}</p>
            </div>
          )}

          <div className="im-legend">
            <p className="im-legend-title">Υπόμνημα</p>
            <div className="im-legend-row"><span className="im-dot" style={{ background: "#E03A4E" }} /> Κρίσιμος / Υψηλός</div>
            <div className="im-legend-row"><span className="im-dot" style={{ background: "#F2C744" }} /> Μέτριος</div>
            <div className="im-legend-row"><span className="im-dot" style={{ background: "#36C5A8" }} /> Χαμηλός</div>
            <div className="im-legend-row"><span className="im-flow-key" /> Πορεία εξάπλωσης</div>
            <div className="im-legend-row"><span className="im-dot im-dot-sm" style={{ background: "#ff6fb0" }} /> Καταγραφές GBIF</div>
          </div>

          <div className="im-top">
            <p className="im-legend-title"><AlertTriangle size={13} /> Ζώνες με μεγαλύτερο κίνδυνο</p>
            {topZones.map((z) => {
              const rn = riskNode(z.risk);
              const active = z.id === selectedZone?.id;
              return (
                <button
                  key={z.id}
                  type="button"
                  className={`im-top-row ${active ? "active" : ""}`}
                  onClick={() => onSelectZone?.(z.id)}
                  onMouseEnter={() => setHoverId(z.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <span className="im-top-name">{z.area}</span>
                  <span className="im-top-bar"><i style={{ width: `${z.risk}%`, background: rn.color }} /></span>
                  <b>{z.risk}</b>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function GaugeRing({ value, display, label, sub, color, icon: Icon, orbit }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(100, value || 0));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(v), 90);
    return () => clearTimeout(t);
  }, [v]);
  const off = C * (1 - shown / 100);
  return (
    <div className="gauge">
      <div className="gauge-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} className="gauge-track" />
          <g className="gauge-sweep" style={{ color }}>
            <line x1="50" y1="50" x2="50" y2="17" />
          </g>
          <circle
            cx="50"
            cy="50"
            r={R}
            className="gauge-arc"
            stroke={color}
            strokeDasharray={C}
            style={{ strokeDashoffset: off, filter: `drop-shadow(0 0 4px ${color})` }}
          />
          {orbit && (
            <g className="gauge-orbit">
              <circle cx="50" cy="16" r="2.8" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
            </g>
          )}
        </svg>
        <span className="gauge-val">{display ?? Math.round(v)}</span>
      </div>
      <div className="gauge-meta">
        <span className="gauge-label">{Icon && <Icon size={13} aria-hidden="true" />} {label}</span>
        <span className="gauge-sub">{sub}</span>
      </div>
    </div>
  );
}

function FlowParticles({ projection, corridors, center }) {
  const routes = useMemo(
    () =>
      corridors.map((c) => {
        const wp = c.waypoints; // [lon,lat]
        const pts = [];
        for (let i = 0; i < wp.length - 1; i += 1) {
          const interp = geoInterpolate(wp[i], wp[i + 1]);
          for (let s = 0; s < 14; s += 1) pts.push(interp(s / 14));
        }
        pts.push(wp[wp.length - 1]);
        return { id: c.id, color: c.intensity >= 0.85 ? "#FF3D5E" : "#FF7A3D", pts };
      }),
    [corridors]
  );

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const loop = (t) => {
      setPhase((t / 4200) % 1);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const vis = (lon, lat) => geoDistance([lon, lat], center) < Math.PI / 2 - 0.01;
  const PARTICLES = 3;
  return (
    <g className="flow-particles" aria-hidden="true">
      {routes.flatMap((rt) =>
        Array.from({ length: PARTICLES }, (_, pi) => {
          const f = (phase + pi / PARTICLES) % 1;
          const idx = Math.min(rt.pts.length - 1, Math.floor(f * (rt.pts.length - 1)));
          const pt = rt.pts[idx];
          if (!pt || !vis(pt[0], pt[1])) return null;
          const p = projection(pt);
          if (!p) return null;
          return <circle key={`${rt.id}-${pi}`} cx={p[0]} cy={p[1]} r={2.6} fill={rt.color} style={{ filter: `drop-shadow(0 0 4px ${rt.color})` }} />;
        })
      )}
    </g>
  );
}
