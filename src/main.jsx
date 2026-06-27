import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import * as THREE from "three";
import {
  AlertTriangle,
  Anchor,
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  ChevronUp,
  ChevronDown,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Download,
  Database,
  FileSpreadsheet,
  Fish,
  Gauge,
  Home,
  Layers,
  LocateFixed,
  MapPin,
  Megaphone,
  Radio,
  Radar,
  Satellite,
  Search,
  ShieldCheck,
  Siren,
  Target,
  TrendingUp,
  Upload,
  Users,
  Waves,
  XCircle
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import {
  fetchMarine,
  fetchMarineBatch,
  fetchOccurrencePoints,
  countPointsNear,
  computeLiveZone,
  geocodeGreece,
} from "./data/seaData.js";
import { BASE_ZONES, AREA_ALIASES } from "./data/zones.js";
import GreeceGlobe from "./components/GreeceGlobe.jsx";
import { LangProvider, useLang } from "./lang.jsx";

const riskZones = BASE_ZONES.map((z) => ({
  risk: 38,
  level: "Υπό φόρτωση",
  color: "#5f7480",
  reports48h: 0,
  satellite: "Φόρτωση δεδομένων…",
  lastReport: "—",
  recommendation: "Φόρτωση ζωντανών δεδομένων…",
  kg7d: 0,
  bites: 0,
  ...z,
}));

const initialSightings = [
  {
    id: "S-2401",
    area: "Ρόδος - Φαληράκι",
    lat: 36.339,
    lng: 28.208,
    time: "σήμερα 10:48",
    ai: 87,
    status: "pending",
    source: "Πολίτης",
    comment: "Εντοπίστηκε κοντά σε βράχια, δεν αγγίχτηκε.",
    bite: "Όχι"
  },
  {
    id: "S-2402",
    area: "Ηράκλειο - Αμμουδάρα",
    lat: 35.337,
    lng: 25.07,
    time: "σήμερα 09:12",
    ai: 92,
    status: "verified",
    source: "Λουόμενος",
    comment: "Μεγάλο ψάρι στην άμμο.",
    bite: "Ναι"
  },
  {
    id: "S-2403",
    area: "Κως - Τιγκάκι",
    lat: 36.885,
    lng: 27.191,
    time: "χθες 17:40",
    ai: 78,
    status: "verified",
    source: "Πολίτης",
    comment: "Φωτογραφία από παραλία.",
    bite: "Όχι"
  }
];

const initialCatches = [
  {
    id: "F-103",
    vessel: "ΑΓ. ΝΙΚΟΛΑΟΣ",
    port: "Ηράκλειο",
    kg: 74,
    area: "Νότια Κρήτη",
    gps: "34.96, 25.18",
    damage: "Ζημιά σε δίχτυα",
    status: "ελέγχεται"
  },
  {
    id: "F-104",
    vessel: "ΕΥΑΓΓΕΛΙΑ",
    port: "Ρόδος",
    kg: 38,
    area: "Ανατολική Ρόδος",
    gps: "36.22, 28.29",
    damage: "Παραγάδι",
    status: "δηλώθηκε"
  }
];

const satelliteFeeds = [
  {
    id: "sst",
    name: "Open-Meteo Marine · SST",
    signal: 96,
    cadence: "ζωντανά, ανά ώρα",
    detail: "Θερμοκρασία επιφάνειας θάλασσας (πραγματικά δεδομένα)",
    status: "live"
  },
  {
    id: "currents",
    name: "Open-Meteo Marine · Ρεύματα & κύμα",
    signal: 92,
    cadence: "ζωντανά, ανά ώρα",
    detail: "Ταχύτητα/κατεύθυνση ρευμάτων και ύψος κύματος",
    status: "live"
  },
  {
    id: "gbif",
    name: "GBIF · Καταγραφές είδους",
    signal: 90,
    cadence: "ζωντανά",
    detail: "Πραγματικές καταγραφές Lagocephalus sceleratus (iNaturalist/HCMR/μουσεία)",
    status: "live"
  },
  {
    id: "copernicus",
    name: "Copernicus Marine · χλωροφύλλη",
    signal: 60,
    cadence: "υπό ενσωμάτωση",
    detail: "Βιογεωχημικά & δορυφορικά προϊόντα (επόμενη φάση)",
    status: "planned"
  },
  {
    id: "bathymetry",
    name: "EMODnet Bathymetry",
    signal: 55,
    cadence: "υπό ενσωμάτωση",
    detail: "Βάθος, κλίση βυθού, απόσταση ακτής (επόμενη φάση)",
    status: "planned"
  }
];

const aiModels = [
  {
    name: "Satellite Fusion AI",
    confidence: 93,
    purpose: "Συνθέτει δορυφορικές και θαλάσσιες μεταβλητές."
  },
  {
    name: "Vision Recognition",
    confidence: 88,
    purpose: "Αναγνωρίζει χαρακτηριστικά λαγοκέφαλου από φωτογραφίες."
  },
  {
    name: "Hotspot Predictor",
    confidence: 91,
    purpose: "Προβλέπει πιθανές ζώνες παρουσίας 24/48/72h."
  },
  {
    name: "Duplicate Guard",
    confidence: 86,
    purpose: "Ελέγχει διπλές, ψευδείς ή ύποπτες αναφορές."
  },
  {
    name: "Authority Copilot",
    confidence: 90,
    purpose: "Παράγει σύνοψη, ειδοποίηση και αναφορά φορέα."
  }
];

const roles = [
  { id: "citizen", label: "Πολίτης / λουόμενος", labelEn: "Citizen / swimmer", icon: Users },
  { id: "fisherman", label: "Ψαράς", labelEn: "Fisherman", icon: Anchor },
  { id: "authority", label: "Δήμος / Περιφέρεια", labelEn: "Municipality / Region", icon: BarChart3 },
  { id: "admin", label: "Admin", labelEn: "Admin", icon: ShieldCheck }
];

const areaAliases = AREA_ALIASES;

function App() {
  const { lang, setLang, t } = useLang();
  const [role, setRole] = useState("citizen");
  const [selectedZoneId, setSelectedZoneId] = useState("rhodes");
  const [sightings, setSightings] = useState(initialSightings);
  const [catches, setCatches] = useState(initialCatches);
  const [activePanel, setActivePanel] = useState("map");
  const [reportResult, setReportResult] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSearchNotice, setAreaSearchNotice] = useState("");

  // ---- Πραγματικά δεδομένα (Open-Meteo Marine + GBIF) ----
  const [rawByZone, setRawByZone] = useState({}); // id -> { marine, occ }
  const [liveStatus, setLiveStatus] = useState("loading"); // loading | ready | error
  const [liveError, setLiveError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [realPoints, setRealPoints] = useState([]); // πραγματικές καταγραφές GBIF
  const [searchResult, setSearchResult] = useState(null); // ad-hoc geocoded location

  const aliveRef = useRef(true);

  // Φόρτωση όλων των ζωνών: batch Open-Meteo Marine (σε λίγες κλήσεις) +
  // εθνικά σημεία GBIF (binning ανά ζώνη) — κλιμακώνεται σε δεκάδες ζώνες.
  const loadLiveData = useCallback(async () => {
    setLiveStatus("loading");
    setLiveError("");
    try {
      // 1) SST/ρεύματα σε batches των 25 τοποθεσιών
      const CHUNK = 25;
      const chunks = [];
      for (let i = 0; i < riskZones.length; i += CHUNK) chunks.push(riskZones.slice(i, i + CHUNK));
      const marineResults = await Promise.allSettled(
        chunks.map((ch) => fetchMarineBatch(ch.map((z) => z.coords)))
      );
      const marineByZone = {};
      chunks.forEach((ch, ci) => {
        const res = marineResults[ci];
        ch.forEach((z, k) => {
          marineByZone[z.id] = res.status === "fulfilled" && res.value[k] ? res.value[k] : null;
        });
      });

      // 2) εθνικά σημεία GBIF (μία φορά) → μέτρημα παρουσίας ανά ζώνη
      let pts = [];
      try {
        pts = await fetchOccurrencePoints();
      } catch {
        pts = [];
      }

      if (!aliveRef.current) return;
      const next = {};
      let ok = 0;
      riskZones.forEach((z) => {
        const marine = marineByZone[z.id] || null;
        const recent = countPointsNear(pts, z.coords[0], z.coords[1]);
        next[z.id] = { marine, occ: { recent, total: recent } };
        if (marine || recent) ok += 1;
      });
      setRawByZone(next);
      setRealPoints(pts);
      setLastUpdated(new Date());
      if (ok === 0) {
        setLiveStatus("error");
        setLiveError("Δεν ήταν δυνατή η σύνδεση με τις πηγές δεδομένων. Εμφανίζονται demo τιμές.");
      } else {
        setLiveStatus("ready");
      }
    } catch (e) {
      if (aliveRef.current) {
        setLiveStatus("error");
        setLiveError("Σφάλμα φόρτωσης ζωντανών δεδομένων. Εμφανίζονται demo τιμές.");
      }
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    loadLiveData();
    return () => {
      aliveRef.current = false;
    };
  }, [loadLiveData]);

  // Συγχώνευση: base ζώνη + ζωντανός υπολογισμός κινδύνου (ανανεώνεται και με νέες αναφορές)
  const liveZones = useMemo(() => {
    return riskZones.map((zone) => {
      const raw = rawByZone[zone.id];
      if (!raw || (!raw.marine && !raw.occ)) {
        return { ...zone, live: false };
      }
      const namePart = zone.area.split(/[ /]/)[0];
      const localSightings = sightings.filter((s) => (s.area || "").includes(namePart));
      const localReports = localSightings.length;
      const bites =
        (zone.bites || 0) + localSightings.filter((s) => s.bite === "Ναι").length;
      const localKg = catches
        .filter((c) => (c.area || "").includes(namePart) || (c.port || "").includes(namePart))
        .reduce((sum, c) => sum + Number(c.kg || 0), 0);
      const computed = computeLiveZone({
        marine: raw.marine,
        occ: raw.occ,
        localReports,
        localKg,
        bites,
      });
      return { ...zone, ...computed, live: true };
    });
  }, [rawByZone, sightings, catches]);

  // Ζώνες προς εμφάνιση = προκαθορισμένες + (προαιρετικά) η ad-hoc περιοχή αναζήτησης
  const displayZones = useMemo(
    () => (searchResult ? [...liveZones, searchResult] : liveZones),
    [liveZones, searchResult]
  );

  const selectedZone = displayZones.find((zone) => zone.id === selectedZoneId) || displayZones[0];
  // Επίπεδο κινδύνου δίγλωσσο (EN από το risk score, EL από το έτοιμο label)
  const lvl = (z) => {
    if (lang === "el") return z.level;
    if (!z.live) return "Loading…";
    const r = z.risk;
    return r >= 82 ? "Critical" : r >= 66 ? "High" : r >= 48 ? "Moderate-high" : r >= 30 ? "Moderate" : "Low";
  };
  const verifiedSightings = sightings.filter((item) => item.status === "verified");
  const pendingSightings = sightings.filter((item) => item.status === "pending");
  const totalKg = catches.reduce((sum, item) => sum + Number(item.kg || 0), 0);
  const severeZones = displayZones.filter((zone) => zone.risk >= 80).length;
  const handleSelectZone = useCallback((zoneId) => setSelectedZoneId(zoneId), []);
  const forecast = useMemo(
    () => selectedZone.forecast || buildForecast(selectedZone, sightings, catches),
    [selectedZone, sightings, catches]
  );
  const authorityAction = useMemo(
    () => buildAuthorityAction(selectedZone, forecast),
    [selectedZone, forecast]
  );

  const reportRows = useMemo(
    () =>
      sightings.map((item) => ({
        ID: item.id,
        Περιοχή: item.area,
        Πηγή: item.source,
        "AI %": item.ai,
        Κατάσταση: statusLabel(item.status),
        Ώρα: item.time,
        Δάγκωμα: item.bite
      })),
    [sightings]
  );

  function locateUser() {
    if (!navigator.geolocation) {
      setUserPosition([36.893, 27.288]);
      setSelectedZoneId("kos");
      setAreaQuery("Κως");
      setAreaSearchNotice("Χρησιμοποιούμε demo θέση κοντά στην Κω.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setUserPosition(coords);
        const nearest = nearestZone(coords);
        setSelectedZoneId(nearest.id);
        setAreaQuery(nearest.area);
        setAreaSearchNotice(`Βρέθηκε κοντινή ζώνη: ${nearest.area}.`);
      },
      () => {
        setUserPosition([36.893, 27.288]);
        setSelectedZoneId("kos");
        setAreaQuery("Κως");
        setAreaSearchNotice("Δεν πήραμε GPS. Δείχνουμε demo αποτέλεσμα για Κω.");
      },
      { enableHighAccuracy: true, timeout: 4500 }
    );
  }

  async function handleAreaSearch(event) {
    event.preventDefault();
    const q = areaQuery.trim();
    if (!q) return;
    const match = findAreaZone(q);

    // 1) Προκαθορισμένη ζώνη (άμεσο)
    if (match) {
      setSearchResult(null);
      const liveMatch = liveZones.find((z) => z.id === match.id) || match;
      setSelectedZoneId(match.id);
      setAreaQuery(match.area);
      setAreaSearchNotice(`Αποτέλεσμα για ${match.area}: Risk Score ${liveMatch.risk}/100.`);
      setActivePanel("map");
      return;
    }

    // 2) Geocoding fallback — ΟΠΟΙΑΔΗΠΟΤΕ ελληνική περιοχή/παραλία
    setAreaSearchNotice(`Αναζήτηση «${q}»…`);
    try {
      const geo = await geocodeGreece(q);
      if (!geo) {
        setAreaSearchNotice(`Δεν βρέθηκε «${q}». Δοκίμασε όνομα παράκτιας περιοχής ή νησιού της Ελλάδας.`);
        return;
      }
      const [marine, recent] = await Promise.all([
        fetchMarine(geo.lat, geo.lon).catch(() => null),
        Promise.resolve(countPointsNear(realPoints, geo.lat, geo.lon)),
      ]);
      const computed = computeLiveZone({ marine, occ: { recent, total: recent } });
      const result = {
        id: "__search",
        area: geo.name,
        region: geo.admin || "Αναζήτηση",
        coords: [geo.lat, geo.lon],
        reports48h: 0,
        kg7d: 0,
        bites: 0,
        ...computed,
        live: true,
      };
      setSearchResult(result);
      setSelectedZoneId("__search");
      setAreaQuery(geo.name);
      setAreaSearchNotice(`Αποτέλεσμα για ${geo.name}: Risk Score ${computed.risk}/100.`);
      setActivePanel("map");
    } catch {
      setAreaSearchNotice("Δεν ήταν δυνατή η αναζήτηση αυτή τη στιγμή. Δοκίμασε ξανά.");
    }
  }

  function quickSelectArea(zoneId) {
    const zone = liveZones.find((item) => item.id === zoneId);
    if (!zone) return;
    setSearchResult(null);
    setSelectedZoneId(zone.id);
    setAreaQuery(zone.area);
    setAreaSearchNotice(`Αποτέλεσμα για ${zone.area}: Risk Score ${zone.risk}/100.`);
    setActivePanel("map");
  }

  const roleToPanel = { citizen: "report", fisherman: "fisherman", authority: "authority", admin: "admin" };
  function goToPanel(panel) {
    setActivePanel(panel);
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("panel-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
  function selectRole(roleId) {
    setRole(roleId);
    goToPanel(roleToPanel[roleId] || "home");
  }

  function submitCitizenReport(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const photo = form.get("photo");
    const area = form.get("area") || selectedZone.area;
    const alive = form.get("condition");
    const bite = form.get("bite");
    const comment = form.get("comment") || "Νέα αναφορά από πολίτη.";
    const ai = estimateImageProbability(photo?.name, alive, bite);
    const report = {
      id: `S-${Math.floor(3000 + Math.random() * 7000)}`,
      area,
      lat: userPosition?.[0] || selectedZone.coords[0],
      lng: userPosition?.[1] || selectedZone.coords[1],
      time: "τώρα",
      ai,
      status: "pending",
      source: "Πολίτης",
      comment,
      bite
    };
    setSightings((current) => [report, ...current]);
    setReportResult(report);
    setActivePanel("ai");
    event.currentTarget.reset();
  }

  function submitCatch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const catchItem = {
      id: `F-${Math.floor(200 + Math.random() * 800)}`,
      vessel: form.get("vessel") || "ΑΝΩΝΥΜΟ ΣΚΑΦΟΣ",
      port: form.get("port") || selectedZone.area,
      kg: Number(form.get("kg") || 0),
      area: form.get("area") || selectedZone.area,
      gps: form.get("gps") || `${selectedZone.coords[0].toFixed(3)}, ${selectedZone.coords[1].toFixed(3)}`,
      damage: form.get("damage") || "Δεν δηλώθηκε",
      status: "δηλώθηκε"
    };
    setCatches((current) => [catchItem, ...current]);
    event.currentTarget.reset();
  }

  function updateSighting(id, status) {
    setSightings((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  function exportCsv() {
    const csv = toCsv(reportRows);
    downloadBlob(csv, "ev-sea-guard-ai-reports.csv", "text/csv;charset=utf-8");
  }

  function exportPdf() {
    const rows = reportRows
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.ID)}</td><td>${escapeHtml(row.Περιοχή)}</td><td>${escapeHtml(
            row.Πηγή
          )}</td><td>${row["AI %"]}%</td><td>${escapeHtml(row.Κατάσταση)}</td><td>${escapeHtml(
            row.Ώρα
          )}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>EV SEA GUARD AI Report</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#10202a}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ccd6dd;padding:8px;text-align:left}th{background:#edf6f8}.risk{font-weight:700;color:#b51d1d}</style></head><body><h1>EV SEA GUARD AI - Αναφορά Περιοχής</h1><p>Περιοχή: <strong>${selectedZone.area}</strong> | Risk Score: <span class="risk">${selectedZone.risk}/100</span> | Επίπεδο: ${selectedZone.level}</p><p>${selectedZone.recommendation}</p><table><thead><tr><th>ID</th><th>Περιοχή</th><th>Πηγή</th><th>AI</th><th>Κατάσταση</th><th>Ώρα</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank", "width=960,height=720");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      // Popup μπλοκαρισμένο: κατέβασε το HTML ως αρχείο για εκτύπωση/PDF
      downloadBlob(html, "ev-sea-guard-ai-report.html", "text/html;charset=utf-8");
      alert("Το αναδυόμενο παράθυρο μπλοκαρίστηκε. Κατεβάσαμε την αναφορά ως αρχείο HTML — άνοιξέ το και τύπωσέ το σε PDF.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Κύρια πλοήγηση">
        <div className="brand-block">
          <div className="brand-mark">
            <Waves size={23} aria-hidden="true" />
          </div>
          <div>
            <strong>EV SEA GUARD AI</strong>
            <span>{t("Θαλάσσια προστασία", "Marine protection")}</span>
          </div>
        </div>

        <div className="role-stack" aria-label={t("Επιλογή ρόλου", "Choose role")}>
          {roles.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`role-button ${role === item.id ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => selectRole(item.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{lang === "en" ? item.labelEn : item.label}</span>
              </button>
            );
          })}
        </div>

        <nav className="section-nav" aria-label={t("Ενότητες", "Sections")}>
          <NavButton icon={Home} label={t("Αρχική", "Home")} active={activePanel === "home"} onClick={() => goToPanel("home")} />
          <NavButton icon={MapPin} label={t("Χάρτης", "Map")} active={activePanel === "map"} onClick={() => goToPanel("map")} />
          <NavButton icon={Camera} label={t("Αναφορά", "Report")} active={activePanel === "report"} onClick={() => goToPanel("report")} />
          <NavButton icon={Anchor} label={t("Ψαράς", "Fisherman")} active={activePanel === "fisherman"} onClick={() => goToPanel("fisherman")} />
          <NavButton icon={BarChart3} label={t("Φορέας", "Authority")} active={activePanel === "authority"} onClick={() => goToPanel("authority")} />
          <NavButton icon={ShieldCheck} label="Admin" active={activePanel === "admin"} onClick={() => goToPanel("admin")} />
        </nav>

        <div className="sidebar-credit">
          <span className="sidebar-credit-by">powered by</span>
          <strong>EV LABS AI</strong>
          <span className="sidebar-credit-site">evlabsai.gr</span>
        </div>
      </aside>

      <main className="main-surface">
        <header className="topbar">
          <div className="topbar-title">
            <BrandLogo3D />
            <div>
              <p className="eyebrow">{t("Ζωντανός χάρτης κινδύνου · EV LABS AI", "Live risk map · EV LABS AI")}</p>
              <h1>{t("Δες τι συμβαίνει σήμερα στη θάλασσα γύρω σου.", "See what's happening in the sea around you today.")}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="lang-toggle" role="group" aria-label="Language">
              <button type="button" className={lang === "el" ? "on" : ""} onClick={() => setLang("el")} aria-pressed={lang === "el"}>ΕΛ</button>
              <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button>
            </div>
            <button type="button" className="primary-action" onClick={locateUser}>
              <LocateFixed size={18} aria-hidden="true" />
              {t("Δες την περιοχή μου", "See my area")}
            </button>
            <button type="button" className="secondary-action" onClick={() => setActivePanel("report")}>
              <Upload size={18} aria-hidden="true" />
              {t("Αναφορά λαγοκέφαλου", "Report a pufferfish")}
            </button>
          </div>
        </header>

        <LiveDataBar
          status={liveStatus}
          error={liveError}
          lastUpdated={lastUpdated}
          selectedZone={selectedZone}
          pointsCount={realPoints.length}
          onRefresh={loadLiveData}
        />

        <AreaSearchPanel
          query={areaQuery}
          setQuery={setAreaQuery}
          selectedZone={selectedZone}
          forecast={forecast}
          notice={areaSearchNotice}
          zones={displayZones}
          onSearch={handleAreaSearch}
          onQuickSelect={quickSelectArea}
          onLocate={locateUser}
          onReport={() => setActivePanel("report")}
          onSafety={() => setActivePanel("home")}
        />

        <SeaGuard3D
          selectedZone={selectedZone}
          forecast={forecast}
          zones={displayZones}
          onSelectZone={handleSelectZone}
        />

        <GreeceGlobe
          selectedZone={selectedZone}
          zones={displayZones}
          onSelectZone={handleSelectZone}
          realPoints={realPoints}
        />

        <IntelligenceStrip forecast={forecast} selectedZone={selectedZone} />

        <section className="metrics-grid" aria-label={t("Σύνοψη κινδύνου", "Risk summary")}>
          <Metric icon={Gauge} label="Risk Score" value={`${selectedZone.risk}/100`} tone={selectedZone.risk >= 80 ? "danger" : "warn"} />
          <Metric
            icon={Waves}
            label={t("Θερμοκρασία SST", "Sea temp (SST)")}
            value={selectedZone.sst != null ? `${selectedZone.sst.toFixed(1)}°C` : "—"}
            tone={selectedZone.sst != null && selectedZone.sst >= 24 ? "danger" : "default"}
          />
          <Metric icon={TrendingUp} label={t("Πρόβλεψη 72h", "72h forecast")} value={`${forecast[2].score}/100`} tone={forecast[2].score >= 80 ? "danger" : "warn"} />
          <Metric icon={BrainCircuit} label={t("Κάλυψη δεδομένων", "Data coverage")} value={`${forecast.confidence}%`} />
        </section>

        <div className="workspace-grid">
          <section className="map-panel" aria-label={t("Χάρτης Ελλάδας με ζώνες κινδύνου", "Greece map with risk zones")}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t("Χάρτης Ελλάδας · ζωντανά δεδομένα", "Greece map · live data")}</p>
                <h2>{t("Ζώνες κινδύνου λαγοκέφαλου", "Pufferfish risk zones")}</h2>
              </div>
              <RiskLegend />
            </div>
            <p className="map-source-note">
              <span className="gbif-dot" aria-hidden="true" /> {t(
                `Γαλάζιες κουκκίδες = πραγματικές καταγραφές GBIF (${realPoints.length}). Κύκλοι = ζώνες με ζωντανό Risk Score.`,
                `Blue dots = real GBIF records (${realPoints.length}). Circles = zones with a live Risk Score.`
              )}
            </p>

            <MapContainer center={[38.1, 24.1]} zoom={6} scrollWheelZoom={false} className="risk-map">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToZone zone={selectedZone} />
              {realPoints.map((pt, index) => (
                <CircleMarker
                  key={`gbif-${index}`}
                  center={[pt.lat, pt.lng]}
                  radius={2.5}
                  pathOptions={{ color: "#7fe3ff", fillColor: "#7fe3ff", fillOpacity: 0.6, weight: 0 }}
                >
                  <Popup>
                    {t("Πραγματική καταγραφή GBIF", "Real GBIF record")}
                    <br />
                    Lagocephalus sceleratus{pt.year ? ` · ${pt.year}` : ""}
                  </Popup>
                </CircleMarker>
              ))}
              {displayZones.map((zone) => (
                <CircleMarker
                  key={zone.id}
                  center={zone.coords}
                  pathOptions={{
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: selectedZoneId === zone.id ? 0.75 : 0.48,
                    weight: selectedZoneId === zone.id ? 4 : 2
                  }}
                  radius={10 + zone.risk / 8}
                  eventHandlers={{ click: () => setSelectedZoneId(zone.id) }}
                >
                  <Popup>
                    <strong>{zone.area}</strong>
                    <br />
                    Risk Score: {zone.risk}/100 · {lvl(zone)}
                    {zone.sst != null && (
                      <>
                        <br />
                        SST: {zone.sst.toFixed(1)}°C
                      </>
                    )}
                    {zone.occRecent != null && (
                      <>
                        <br />
                        {t("Καταγραφές GBIF (3ετία)", "GBIF records (3y)")}: {zone.occRecent}
                      </>
                    )}
                  </Popup>
                </CircleMarker>
              ))}
              {userPosition && (
                <CircleMarker
                  center={userPosition}
                  radius={8}
                  pathOptions={{ color: "#ffffff", fillColor: "#225c73", fillOpacity: 0.85, weight: 3 }}
                >
                  <Popup>{t("Η θέση σου", "Your location")}</Popup>
                </CircleMarker>
              )}
            </MapContainer>
          </section>

          <aside className="zone-panel" aria-label={t("Κάρτα περιοχής", "Area card")}>
            <div className="zone-head">
              <div>
                <p className="eyebrow">{t("Περιοχή", "Area")}</p>
                <h2>{selectedZone.area}</h2>
              </div>
              <span className="risk-pill" style={{ backgroundColor: selectedZone.color }}>
                {lvl(selectedZone)}
              </span>
            </div>
            <div className="risk-score">
              <span>{selectedZone.risk}</span>
              <small>/100</small>
            </div>
            <dl className="zone-facts">
              <div>
                <dt>{t("Δορυφορικές συνθήκες", "Satellite conditions")}</dt>
                <dd>{lang === "en" && selectedZone.satelliteEn ? selectedZone.satelliteEn : selectedZone.satellite}</dd>
              </div>
              <div>
                <dt>{t("Καταγραφές 3ετίας", "Records (3y)")}</dt>
                <dd>{selectedZone.occRecent != null ? selectedZone.occRecent : "—"}</dd>
              </div>
              <div>
                <dt>{t("Σύσταση", "Recommendation")}</dt>
                <dd>{lang === "en" && selectedZone.recommendationEn ? selectedZone.recommendationEn : selectedZone.recommendation}</dd>
              </div>
            </dl>
            <div className="zone-actions">
              <button type="button" className="primary-action" onClick={() => setActivePanel("report")}>
                <Camera size={18} aria-hidden="true" />
                {t("Κάνε αναφορά", "Report")}
              </button>
              <button type="button" className="secondary-action" onClick={() => setActivePanel("home")}>
                <ShieldCheck size={18} aria-hidden="true" />
                {t("Οδηγίες", "Safety")}
              </button>
            </div>
          </aside>
        </div>

        <section className="content-switcher" id="panel-section">
          {activePanel === "home" && <HomePanel />}
          {activePanel === "map" && (
            <RiskEnginePanel selectedZone={selectedZone} sightings={sightings} catches={catches} forecast={forecast} />
          )}
          {activePanel === "report" && (
            <CitizenReportPanel onSubmit={submitCitizenReport} selectedZone={selectedZone} locateUser={locateUser} />
          )}
          {activePanel === "ai" && <AiResultPanel report={reportResult} />}
          {activePanel === "fisherman" && <FishermanPanel catches={catches} onSubmit={submitCatch} />}
          {activePanel === "authority" && (
            <AuthorityPanel
              sightings={sightings}
              catches={catches}
              selectedZone={selectedZone}
              forecast={forecast}
              authorityAction={authorityAction}
              exportCsv={exportCsv}
              exportPdf={exportPdf}
            />
          )}
          {activePanel === "admin" && (
            <AdminPanel sightings={sightings} updateSighting={updateSighting} pendingSightings={pendingSightings} verifiedSightings={verifiedSightings} />
          )}
        </section>

        <footer className="ev-footer">
          <div className="ev-footer-brand">
            <Waves size={18} aria-hidden="true" />
            <div>
              <strong>EV SEA GUARD AI</strong>
              <span>{t("Μια δημιουργία της", "Created by")} <b>EV LABS AI</b> · evlabsai.gr</span>
            </div>
          </div>
          <p className="ev-footer-note">
            {t(
              "Ψηφιακή υποδομή θαλάσσιας προστασίας για τον λαγοκέφαλο. Πραγματικά δεδομένα: Open-Meteo Marine + GBIF. Δεν αντικαθιστά την επίσημη ενημέρωση — σε επείγον καλέστε 112.",
              "Digital marine-protection infrastructure for the pufferfish. Real data: Open-Meteo Marine + GBIF. Not a substitute for official information — in an emergency call 112."
            )}
          </p>
          <p className="ev-footer-copy">© {new Date().getFullYear()} EV LABS AI — {t("Όλα τα δικαιώματα κατοχυρωμένα.", "All rights reserved.")}</p>
        </footer>
      </main>
      <ScrollDots />
      <SosButton />
    </div>
  );
}

const SCROLL_SECTIONS = [
  { sel: ".topbar", label: "Αρχή" },
  { sel: ".area-search-panel", label: "Περιοχή" },
  { sel: ".mission-theater", label: "Δορυφόρος AI" },
  { sel: ".invasion-map", label: "Χάρτης Ελλάδας" },
  { sel: ".metrics-grid", label: "Δείκτες" },
  { sel: ".workspace-grid", label: "Ζώνες χάρτη" },
  { sel: ".content-switcher", label: "Ενότητες" },
];

function ScrollDots() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const elsRef = useRef([]);

  useEffect(() => {
    const found = SCROLL_SECTIONS.map((s) => ({ label: s.label, el: document.querySelector(s.sel) })).filter(
      (x) => x.el
    );
    elsRef.current = found;
    setItems(found.map((f) => f.label));
    if (!found.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = found.findIndex((f) => f.el === e.target);
            if (idx >= 0) setActive(idx);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    found.forEach((f) => io.observe(f.el));
    return () => io.disconnect();
  }, []);

  const goTo = (i) => {
    const target = elsRef.current[i];
    if (target?.el) target.el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (items.length < 2) return null;

  return (
    <nav className="scroll-rail" aria-label="Πλοήγηση ενοτήτων">
      <button
        type="button"
        className="scroll-arrow"
        onClick={() => goTo(Math.max(0, active - 1))}
        disabled={active === 0}
        aria-label="Προηγούμενη ενότητα"
      >
        <ChevronUp size={16} />
      </button>
      <div className="scroll-dots">
        {items.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`scroll-dot ${i === active ? "active" : ""}`}
            onClick={() => goTo(i)}
            aria-label={label}
            aria-current={i === active ? "true" : undefined}
          >
            <span className="scroll-dot-label">{label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="scroll-arrow"
        onClick={() => goTo(Math.min(items.length - 1, active + 1))}
        disabled={active === items.length - 1}
        aria-label="Επόμενη ενότητα"
      >
        <ChevronDown size={16} />
      </button>
    </nav>
  );
}

function SosButton() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className={`sos-fab ${open ? "open" : ""}`}>
      {open && (
        <div className="sos-menu" role="menu">
          <a href="tel:112" className="sos-line"><Siren size={15} aria-hidden="true" /> 112 · {t("Έκτακτη ανάγκη", "Emergency")}</a>
          <a href="tel:166" className="sos-line">166 · {t("ΕΚΑΒ", "Ambulance")}</a>
          <a href="tel:108" className="sos-line">108 · {t("Λιμενικό", "Coast Guard")}</a>
        </div>
      )}
      <button
        type="button"
        className="sos-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("Τηλέφωνα έκτακτης ανάγκης", "Emergency phone numbers")}
      >
        <Siren size={19} aria-hidden="true" /> SOS
      </button>
    </div>
  );
}

function FlyToZone({ zone }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (zone?.coords) map.flyTo(zone.coords, 9, { duration: 1.1 });
  }, [zone?.id, zone?.coords?.[0], zone?.coords?.[1], map]);
  return null;
}

function LiveDataBar({ status, error, lastUpdated, selectedZone, pointsCount, onRefresh }) {
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const stateLabel =
    status === "loading" ? "Σύνδεση με ζωντανές πηγές…" : status === "error" ? "Αδυναμία σύνδεσης — demo τιμές" : "Ζωντανά δεδομένα ενεργά";
  return (
    <section className={`live-bar live-bar--${status}`} aria-label="Κατάσταση ζωντανών δεδομένων">
      <div className="live-bar-state">
        <span className={`live-dot live-dot--${status}`} aria-hidden="true" />
        <div>
          <strong>{stateLabel}</strong>
          <span>
            Πηγές: Open-Meteo Marine (SST/ρεύματα) · GBIF (πραγματικές καταγραφές){" "}
            {status === "ready" && `· ${pointsCount} σημεία · ${time}`}
          </span>
        </div>
      </div>
      <div className="live-bar-metrics">
        {selectedZone?.sst != null && (
          <span className="live-chip">
            <Waves size={14} aria-hidden="true" /> {selectedZone.area}: {selectedZone.sst.toFixed(1)}°C
          </span>
        )}
        {selectedZone?.occRecent != null && status === "ready" && (
          <span className="live-chip">
            <Fish size={14} aria-hidden="true" /> {selectedZone.occRecent} καταγραφές/3ετία
          </span>
        )}
        <button type="button" className="live-refresh" onClick={onRefresh} disabled={status === "loading"}>
          <Radar size={15} aria-hidden="true" /> Ανανέωση
        </button>
      </div>
      {error && <p className="live-bar-error">{error}</p>}
    </section>
  );
}

function IntelligenceStrip({ forecast, selectedZone }) {
  return (
    <section className="intelligence-strip" aria-label="AI επιχειρησιακή πρόβλεψη">
      <article>
        <Radar size={20} aria-hidden="true" />
        <span>Current risk</span>
        <strong>{selectedZone.risk}/100</strong>
      </article>
      {forecast.map((item) => (
        <article key={item.label}>
          <Clock3 size={20} aria-hidden="true" />
          <span>{item.label}</span>
          <strong>{item.score}/100</strong>
        </article>
      ))}
      <article>
        <BrainCircuit size={20} aria-hidden="true" />
        <span>Model confidence</span>
        <strong>{forecast.confidence}%</strong>
      </article>
      <article className="decision">
        <Siren size={20} aria-hidden="true" />
        <span>AI recommendation</span>
        <strong>{forecast.recommendation}</strong>
      </article>
    </section>
  );
}

function BrandLogo3D() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 1.45);
    shieldShape.bezierCurveTo(0.95, 1.15, 1.22, 0.98, 1.32, 0.86);
    shieldShape.bezierCurveTo(1.2, -0.4, 0.78, -1.16, 0, -1.52);
    shieldShape.bezierCurveTo(-0.78, -1.16, -1.2, -0.4, -1.32, 0.86);
    shieldShape.bezierCurveTo(-1.22, 0.98, -0.95, 1.15, 0, 1.45);

    const shield = new THREE.Mesh(
      new THREE.ShapeGeometry(shieldShape),
      new THREE.MeshStandardMaterial({
        color: 0x12475a,
        emissive: 0x062b36,
        metalness: 0.55,
        roughness: 0.26,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      })
    );
    shield.position.z = -0.12;
    group.add(shield);

    const shieldLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(shield.geometry),
      new THREE.LineBasicMaterial({ color: 0x9ff8ff, transparent: true, opacity: 0.72 })
    );
    shieldLine.position.copy(shield.position);
    group.add(shieldLine);

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(1.58, 0.018, 10, 120),
      new THREE.MeshBasicMaterial({ color: 0x84f6ff, transparent: true, opacity: 0.72 })
    );
    orbit.rotation.set(1.16, 0.28, 0.38);
    group.add(orbit);

    const waveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.86, -0.42, 0.18),
      new THREE.Vector3(-0.42, -0.24, 0.24),
      new THREE.Vector3(0, -0.48, 0.3),
      new THREE.Vector3(0.48, -0.26, 0.24),
      new THREE.Vector3(0.9, -0.44, 0.18)
    ]);
    const wave = new THREE.Mesh(
      new THREE.TubeGeometry(waveCurve, 34, 0.035, 8, false),
      new THREE.MeshBasicMaterial({ color: 0x2ed8c4 })
    );
    group.add(wave);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.36, 2),
      new THREE.MeshStandardMaterial({
        color: 0xeaffff,
        emissive: 0x3cecff,
        emissiveIntensity: 0.62,
        metalness: 0.2,
        roughness: 0.18
      })
    );
    group.add(core);

    const fish = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.48, 3),
      new THREE.MeshStandardMaterial({ color: 0xffc94f, emissive: 0x5c2c00, roughness: 0.42 })
    );
    fish.rotation.z = -Math.PI / 2;
    fish.position.set(-0.08, -0.82, 0.34);
    group.add(fish);

    const satellite = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xdffaff, metalness: 0.45, roughness: 0.18 })
    );
    const panelMaterial = new THREE.MeshBasicMaterial({ color: 0x2b98ff, transparent: true, opacity: 0.78 });
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.02), panelMaterial);
    const rightPanel = leftPanel.clone();
    leftPanel.position.x = -0.3;
    rightPanel.position.x = 0.3;
    satellite.add(body, leftPanel, rightPanel);
    group.add(satellite);

    const evText = createTextPlane("EV", "#eaffff", 1.0, 0.42);
    evText.position.set(0, 0.58, 0.36);
    group.add(evText);

    scene.add(new THREE.AmbientLight(0xc8fbff, 0.72));
    const keyLight = new THREE.PointLight(0x9ff8ff, 1.8, 9);
    keyLight.position.set(2, 2.4, 4);
    scene.add(keyLight);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame += 0.018;
      group.rotation.y = Math.sin(frame * 0.7) * 0.28;
      group.rotation.x = Math.sin(frame * 0.48) * 0.08;
      core.rotation.x += 0.016;
      core.rotation.y += 0.02;
      satellite.position.set(Math.cos(frame * 1.5) * 1.42, Math.sin(frame * 1.5) * 0.48, 0.52);
      satellite.rotation.z = frame * 1.5;
      wave.position.y = Math.sin(frame * 2) * 0.035;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      shield.geometry.dispose();
      orbit.geometry.dispose();
      wave.geometry.dispose();
      core.geometry.dispose();
      fish.geometry.dispose();
      body.geometry.dispose();
      leftPanel.geometry.dispose();
      evText.material.map?.dispose();
      evText.material.dispose();
    };
  }, []);

  return (
    <div className="brand-logo-3d" ref={mountRef} aria-label="3D λογότυπο EV Sea Guard AI">
      <span>EV</span>
    </div>
  );
}

function AreaSearchPanel({
  query,
  setQuery,
  selectedZone,
  forecast,
  notice,
  zones,
  onSearch,
  onQuickSelect,
  onLocate,
  onReport,
  onSafety
}) {
  const { t, lang } = useLang();
  const peakForecast = Math.max(...forecast.map((item) => item.score));
  const lvl = (z) => {
    if (lang === "el") return z.level;
    if (!z.live) return "Loading…";
    const r = z.risk;
    return r >= 82 ? "Critical" : r >= 66 ? "High" : r >= 48 ? "Moderate-high" : r >= 30 ? "Moderate" : "Low";
  };

  return (
    <section className="area-search-panel" aria-label={t("Αναζήτηση περιοχής", "Search area")}>
      <div className="area-search-copy">
        <p className="eyebrow">{t("Γρήγορη αναζήτηση", "Quick search")}</p>
        <h2>{t("Γράψε την περιοχή που βρίσκεσαι και δες καθαρό αποτέλεσμα.", "Type your area and get a clear result.")}</h2>
      </div>

      <form className="area-search-form" onSubmit={onSearch}>
        <label className="search-input-wrap">
          <Search size={19} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("π.χ. Ρόδος, Κως, Ηράκλειο, Χαλκιδική", "e.g. Rhodes, Kos, Crete, Santorini")}
            aria-label={t("Περιοχή ή παραλία", "Area or beach")}
          />
        </label>
        <button type="submit" className="primary-action">
          <Target size={18} aria-hidden="true" />
          {t("Δες αποτελέσματα", "Search")}
        </button>
        <button type="button" className="secondary-action" onClick={onLocate}>
          <LocateFixed size={18} aria-hidden="true" />
          GPS
        </button>
      </form>

      <div className="quick-area-grid" aria-label={t("Γρήγορη επιλογή δημοφιλών περιοχών", "Popular areas")}>
        {zones
          .filter((zone) => zone.popular || zone.id === selectedZone.id)
          .map((zone) => (
            <button
              type="button"
              key={zone.id}
              className={zone.id === selectedZone.id ? "active" : ""}
              onClick={() => onQuickSelect(zone.id)}
            >
              <span style={{ backgroundColor: zone.color }} />
              {zone.area}
            </button>
          ))}
      </div>

      {notice && <p className="area-search-notice">{notice}</p>}

      <div className="search-result-card">
        <div className="result-risk" style={{ borderColor: selectedZone.color }}>
          <span>{selectedZone.risk}</span>
          <small>/100</small>
        </div>
        <div className="result-details">
          <p className="eyebrow">{t("Αποτέλεσμα περιοχής", "Area result")}</p>
          <h3>{selectedZone.area}</h3>
          <dl>
            <div>
              <dt>{t("Επίπεδο", "Level")}</dt>
              <dd>{lvl(selectedZone)}</dd>
            </div>
            <div>
              <dt>{t("Θερμοκρασία", "Temperature")}</dt>
              <dd>{selectedZone.sst != null ? `${selectedZone.sst.toFixed(1)}°C` : "—"}</dd>
            </div>
            <div>
              <dt>{t("Πρόβλεψη 72h", "72h forecast")}</dt>
              <dd>{peakForecast}/100</dd>
            </div>
          </dl>
          <p>{lang === "en" && selectedZone.recommendationEn ? selectedZone.recommendationEn : selectedZone.recommendation}</p>
        </div>
        <div className="result-actions">
          <button type="button" className="primary-action" onClick={onReport}>
            <Camera size={18} aria-hidden="true" />
            {t("Κάνε αναφορά", "Report")}
          </button>
          <button type="button" className="secondary-action" onClick={onSafety}>
            <ShieldCheck size={18} aria-hidden="true" />
            {t("Οδηγίες", "Safety")}
          </button>
        </div>
      </div>
    </section>
  );
}

function SeaGuard3D({ selectedZone, forecast, zones, onSelectZone }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x041017, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x041017);
    scene.fog = new THREE.FogExp2(0x041017, 0.08);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 4.4, 7.4);
    camera.lookAt(0, 0.4, 0);

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xa9ecff, 0.55);
    const key = new THREE.PointLight(0x8ff5ff, 3.6, 14);
    key.position.set(0, 4.8, 2.4);
    const warm = new THREE.PointLight(0xffd07a, 1.8, 10);
    warm.position.set(-3.2, 2.2, 2.4);
    scene.add(ambient, key, warm);

    const ocean = createOceanPlane();
    root.add(ocean.mesh);

    const grid = createSeaGrid();
    root.add(grid);

    const aiCore = createAiCore();
    root.add(aiCore.group);

    const orbit = new THREE.Group();
    root.add(orbit);
    const satellites = [createSatellite(0xffd36a), createSatellite(0x79efff), createSatellite(0xb8ffe8)];
    satellites.forEach((satellite, index) => {
      satellite.group.userData.phase = index * ((Math.PI * 2) / satellites.length);
      orbit.add(satellite.group);
    });

    const markerGroup = new THREE.Group();
    root.add(markerGroup);
    const markers = zones.map((zone) => {
      const marker = createRiskMarker(zone);
      marker.group.position.copy(zoneToScene(zone));
      markerGroup.add(marker.group);
      return marker;
    });

    const flowGroup = new THREE.Group();
    root.add(flowGroup);
    const flows = zones.map((zone) => {
      const start = zoneToScene(zone).clone();
      start.y = 0.32 + zone.risk / 135;
      const flow = createDataBeam(start, new THREE.Vector3(0, 1.2, 0), zone.color);
      flowGroup.add(flow.line);
      return flow;
    });

    const systemLabels = [
      createTextPlane("COPERNICUS MARINE", "#bdf5ff", 1.2, 0.18),
      createTextPlane("EMODNET BATHYMETRY", "#ffe0a3", 1.25, 0.18),
      createTextPlane("AI PHOTO RECOGNITION", "#c7ffd8", 1.35, 0.18)
    ];
    systemLabels[0].position.set(-3.0, 2.35, -0.55);
    systemLabels[1].position.set(2.75, 2.0, -0.35);
    systemLabels[2].position.set(0.05, 2.75, 0.12);
    systemLabels.forEach((label) => root.add(label));

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let selectedId = selectedZone.id;
    let selectedForecastPeak = forecast[2].score;
    let animationId = 0;
    let width = 1;
    let height = 1;
    let pointerTiltX = 0;
    let pointerTiltY = 0;

    function resize() {
      const rect = mount.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 720 ? 8.8 : 7.4;
      camera.position.y = width < 720 ? 4.8 : 4.4;
      camera.updateProjectionMatrix();
    }

    function handlePointerMove(event) {
      const rect = mount.getBoundingClientRect();
      pointerTiltX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerTiltY = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    function handlePointerDown(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(markers.map((item) => item.hitTarget), true);
      const hitZone = hits.find((hit) => hit.object.userData.zoneId)?.object.userData.zoneId;
      if (hitZone) onSelectZone(hitZone);
    }

    function animate(timeMs) {
      const time = timeMs * 0.001;
      animationId = window.requestAnimationFrame(animate);

      const positions = ocean.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        positions.setY(i, Math.sin(x * 1.7 + time * 1.35) * 0.045 + Math.cos(z * 2.2 + time * 1.05) * 0.035);
      }
      positions.needsUpdate = true;
      ocean.mesh.rotation.z = Math.sin(time * 0.14) * 0.018;

      root.rotation.y += (pointerTiltX * 0.08 - root.rotation.y) * 0.035;
      root.rotation.x += (pointerTiltY * 0.035 - root.rotation.x) * 0.035;

      aiCore.inner.rotation.x = time * 0.7;
      aiCore.inner.rotation.y = -time * 0.55;
      aiCore.outer.rotation.y = time * 0.32;
      aiCore.forecastRing.scale.setScalar(1 + selectedForecastPeak / 180 + Math.sin(time * 1.7) * 0.04);
      aiCore.forecastRing.material.opacity = 0.13 + selectedForecastPeak / 430;
      aiCore.rings.forEach((ring, index) => {
        ring.rotation.z += (index % 2 ? -0.011 : 0.014);
        ring.material.opacity = 0.22 + Math.sin(time * 1.4 + index) * 0.055;
      });

      satellites.forEach((satellite, index) => {
        const phase = satellite.group.userData.phase + time * (0.28 + index * 0.05);
        satellite.group.position.set(Math.cos(phase) * 3.2, 2.35 + Math.sin(time + index) * 0.18, Math.sin(phase) * 1.55);
        satellite.group.lookAt(0, 0.6, 0);
        satellite.beam.material.opacity = 0.1 + Math.sin(time * 2 + index) * 0.04;
      });

      markers.forEach((marker, index) => {
        const isSelected = marker.zone.id === selectedId;
        marker.pillar.scale.y = 0.65 + marker.zone.risk / 70 + Math.sin(time * 1.6 + index) * 0.025;
        marker.group.scale.setScalar(isSelected ? 1.18 : 1);
        marker.halo.material.opacity = (isSelected ? 0.62 : 0.32) + Math.sin(time * 1.9 + index) * 0.06;
        marker.label.material.opacity = isSelected ? 0.94 : 0.64;
      });

      flows.forEach((flow, index) => {
        flow.line.material.opacity = 0.2 + Math.sin(time * 1.8 + index) * 0.065;
      });

      renderer.render(scene, camera);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    mount.addEventListener("pointermove", handlePointerMove, { passive: true });
    mount.addEventListener("pointerdown", handlePointerDown, { passive: true });
    resize();
    animationId = window.requestAnimationFrame(animate);

    function updateSelected(zoneId, peakScore) {
      selectedId = zoneId;
      selectedForecastPeak = peakScore;
    }
    mount.__updateSeaGuardSelected = updateSelected;

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.__updateSeaGuardSelected = undefined;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [onSelectZone, zones]);

  useEffect(() => {
    if (mountRef.current?.__updateSeaGuardSelected) {
      mountRef.current.__updateSeaGuardSelected(selectedZone.id, forecast[2].score);
    }
  }, [selectedZone.id, forecast]);

  return (
    <section className="mission-theater" aria-label="3D δορυφορική σκηνή EV SEA GUARD AI">
      <div className="theater-copy">
        <p className="eyebrow">3D Satellite AI Layer</p>
        <h2>Δορυφόροι, θαλάσσια δεδομένα και AI συνεργάζονται σε πραγματικό χρόνο.</h2>
        <p>
          Το demo layer δείχνει πώς οι δορυφορικές συνθήκες, οι αναφορές πολιτών, τα κιλά
          αλιέων και η αναγνώριση εικόνας τροφοδοτούν το Lagokefalos Risk Engine.
        </p>
      </div>
      <div className="theater-stage" ref={mountRef} />
    </section>
  );
}

function createOceanPlane() {
  const geometry = new THREE.PlaneGeometry(8.8, 4.8, 120, 70);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x0a6376,
    emissive: 0x073848,
    emissiveIntensity: 0.6,
    roughness: 0.42,
    metalness: 0.28,
    transparent: true,
    opacity: 0.86
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.2;
  return { mesh, geometry };
}

function createSeaGrid() {
  const grid = new THREE.GridHelper(8.4, 24, 0x5eeaff, 0x1d7284);
  grid.position.y = -0.12;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  return grid;
}

function createAiCore() {
  const group = new THREE.Group();
  group.position.set(0, 1.18, 0);
  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.38, 3),
    new THREE.MeshBasicMaterial({ color: 0xdffcff, transparent: true, opacity: 0.92 })
  );
  const outer = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.78, 2),
    new THREE.MeshBasicMaterial({
      color: 0x72eaff,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending
    })
  );
  const label = createTextPlane("LAGOKEFALOS RISK ENGINE", "#ffffff", 1.75, 0.22);
  label.position.set(0, 0.82, 0);
  const forecastRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.28, 0.018, 12, 160),
    new THREE.MeshBasicMaterial({
      color: 0xffd36a,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending
    })
  );
  forecastRing.rotation.x = Math.PI / 2;
  group.add(inner, outer, forecastRing, label);
  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.72 + i * 0.16, 0.01, 10, 120),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xffd06f : 0x5eeaff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      })
    );
    ring.rotation.x = Math.PI / 2 + i * 0.4;
    ring.rotation.y = i * 0.55;
    group.add(ring);
    rings.push(ring);
  }
  return { group, inner, outer, forecastRing, rings };
}

function createSatellite(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.2, 0.2),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.32 })
  );
  const panelMaterial = new THREE.MeshBasicMaterial({ color: 0x132e4d, side: THREE.DoubleSide });
  const leftPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.2), panelMaterial);
  const rightPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.2), panelMaterial);
  leftPanel.position.x = -0.45;
  rightPanel.position.x = 0.45;
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(0, -2.1, 0)]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending })
  );
  group.add(body, leftPanel, rightPanel, beam);
  return { group, beam };
}

function createRiskMarker(zone) {
  const group = new THREE.Group();
  group.userData.zoneId = zone.id;
  const color = new THREE.Color(zone.color);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.14, 0.72 + zone.risk / 70, 18),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.76 })
  );
  pillar.position.y = 0.26 + zone.risk / 140;
  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 18, 18),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  hitTarget.position.y = pillar.position.y + 0.18;
  hitTarget.userData.zoneId = zone.id;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.012, 8, 72),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.03;
  const label = createTextPlane(`${zone.area} ${zone.risk}`, "#ffffff", 0.7, 0.16);
  label.position.y = pillar.position.y + 0.64;
  group.add(pillar, hitTarget, halo, label);
  return { group, zone, pillar, hitTarget, halo, label };
}

function createDataBeam(start, end, colorValue) {
  const curve = new THREE.CatmullRomCurve3([
    start,
    start.clone().lerp(end, 0.38).add(new THREE.Vector3(0, 0.65, 0.18)),
    start.clone().lerp(end, 0.72).add(new THREE.Vector3(0, 0.35, -0.18)),
    end
  ]);
  const points = curve.getPoints(72);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: new THREE.Color(colorValue),
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending
    })
  );
  return { line };
}

function createTextPlane(text, color, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "800 78px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  return sprite;
}

function zoneToScene(zone) {
  const lat = zone.coords[0];
  const lon = zone.coords[1];
  const x = ((lon - 19.2) / (29.2 - 19.2)) * 6.8 - 3.4;
  const z = -(((lat - 34.6) / (41.1 - 34.6)) * 3.2 - 1.6);
  return new THREE.Vector3(x, 0, z);
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button type="button" className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Metric({ icon: Icon, label, value, tone = "default" }) {
  return (
    <article className={`metric ${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RiskLegend() {
  return (
    <div className="legend" aria-label="Υπόμνημα κινδύνου">
      <span><i style={{ background: "#2fa66a" }} />Χαμηλή</span>
      <span><i style={{ background: "#e6c84f" }} />Μέτρια</span>
      <span><i style={{ background: "#f08c2e" }} />Αυξημένη</span>
      <span><i style={{ background: "#e73d3d" }} />Hotspot</span>
      <span><i style={{ background: "#111" }} />Σοβαρό</span>
    </div>
  );
}

function HomePanel() {
  const { t } = useLang();
  const safety = [
    t("Μην αγγίζεις και μην πιάνεις λαγοκέφαλο — έχει δυνατά δόντια και δαγκώνει.", "Do not touch or handle a pufferfish — it has strong teeth and bites."),
    t("ΜΗΝ τον τρως ποτέ. Περιέχει τετροδοτοξίνη, θανατηφόρα τοξίνη που δεν καταστρέφεται με μαγείρεμα.", "NEVER eat it. It contains tetrodotoxin, a deadly toxin that cooking does not destroy."),
    t("Κράτησε παιδιά και κατοικίδια μακριά από νεκρά ψάρια στην ακτή.", "Keep children and pets away from dead fish on the shore."),
    t("Φωτογράφισε από απόσταση και στείλε αναφορά με GPS μέσα από την εφαρμογή.", "Photograph from a distance and send a GPS report through the app."),
  ];
  const firstAid = [
    t("Σε δάγκωμα: ξέπλυνε με καθαρό νερό, σταμάτησε την αιμορραγία με πίεση.", "If bitten: rinse with clean water, stop bleeding with pressure."),
    t("Σε κατάποση ή ύποπτα συμπτώματα (μούδιασμα χειλιών, ναυτία, δυσκολία αναπνοής): κάλεσε ΑΜΕΣΩΣ το 112 / ΕΚΑΒ 166.", "If swallowed or with symptoms (lip numbness, nausea, trouble breathing): call 112 / EKAB 166 IMMEDIATELY."),
    t("Η τετροδοτοξίνη δρα γρήγορα — μη χάνεις χρόνο, ζήτησε ιατρική βοήθεια.", "Tetrodotoxin acts fast — don't lose time, seek medical help."),
    t("Αλιείς: μη ρίχνετε τον λαγοκέφαλο πίσω στη θάλασσα ζωντανό.", "Fishermen: do not throw pufferfish back into the sea alive."),
  ];

  return (
    <section className="panel-grid">
      <article className="info-panel wide danger-banner">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Προσοχή — δηλητηριώδες είδος", "Warning — poisonous species")}</p>
            <h2>{t("Λαγοκέφαλος", "Pufferfish")} (Lagocephalus sceleratus)</h2>
          </div>
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <p>
          {t(
            "Χωροκατακτητικό λεσσεψιανό είδος που έχει εξαπλωθεί στις ελληνικές θάλασσες. Δαγκώνει δίχτυα, παραγάδια και ψάρια, και είναι επικίνδυνα δηλητηριώδης για τον άνθρωπο λόγω τετροδοτοξίνης. Η εφαρμογή συνδυάζει πραγματική θερμοκρασία θάλασσας (SST), πραγματικές καταγραφές του είδους (GBIF) και αναφορές πολιτών/αλιέων για να δείχνει περιοχές αυξημένης πιθανότητας παρουσίας.",
            "An invasive Lessepsian species that has spread across the Greek seas. It bites nets, long-lines and fish, and is dangerously poisonous to humans due to tetrodotoxin. The app combines real sea-surface temperature (SST), real species records (GBIF) and citizen/fisherman reports to show areas of higher likelihood of presence."
          )}
        </p>
      </article>
      <article className="info-panel">
        <h3>{t("Οδηγίες ασφάλειας", "Safety guidance")}</h3>
        <ul className="check-list">
          {safety.map((item) => (
            <li key={item}>
              <ShieldCheck size={17} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </article>
      <article className="info-panel">
        <h3>{t("Πρώτες βοήθειες & έκτακτη ανάγκη", "First aid & emergency")}</h3>
        <ul className="check-list">
          {firstAid.map((item) => (
            <li key={item}>
              <Siren size={17} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <div className="notice-line">
          <Megaphone size={18} aria-hidden="true" />
          {t("Έκτακτη ανάγκη", "Emergency")}: <strong>112</strong> · {t("ΕΚΑΒ", "Ambulance")} <strong>166</strong> · {t("Λιμενικό", "Coast Guard")} <strong>108</strong>
        </div>
      </article>
      <article className="info-panel">
        <h3>{t("Πηγές δεδομένων", "Data sources")}</h3>
        <p className="source-caption">{t("Ζωντανές, ενεργές τώρα:", "Live, active now:")}</p>
        <div className="source-list">
          <span className="source-live">Open-Meteo Marine ({t("SST/ρεύματα", "SST/currents")})</span>
          <span className="source-live">GBIF ({t("καταγραφές είδους", "species records")})</span>
        </div>
        <p className="source-caption">{t("Υπό ενσωμάτωση (επόμενη φάση):", "Being integrated (next phase):")}</p>
        <div className="source-list">
          <span>Copernicus Marine</span>
          <span>EMODnet Bathymetry</span>
          <span>ELNAIS / HCMR</span>
          <span>iSea</span>
        </div>
      </article>
      <article className="info-panel wide disclaimer-panel">
        <div className="notice-line">
          <ShieldCheck size={18} aria-hidden="true" />
          {t(
            "Ενημερωτικό εργαλείο — εκτιμήσεις βάσει δεδομένων, ΟΧΙ ιατρική ή επίσημη οδηγία και ΟΧΙ υποκατάστατο του 112. Ακολουθήστε πάντα τις επίσημες αρχές.",
            "Informational tool — data-based estimates, NOT medical or official guidance and NOT a substitute for 112. Always follow official authorities."
          )}
        </div>
      </article>
    </section>
  );
}

function AiSystem({ title, detail }) {
  return (
    <div className="ai-system">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function RiskEnginePanel({ selectedZone, sightings, catches, forecast }) {
  const bd = selectedZone.breakdown;
  const breakdownRows = bd
    ? [
        {
          label: "Καταλληλότητα θερμοκρασίας (SST)",
          value: bd.sst,
          detail:
            selectedZone.sst != null ? `${selectedZone.sst.toFixed(1)}°C · βαρύτητα 45%` : "βαρύτητα 45%",
        },
        {
          label: "Πραγματική παρουσία (GBIF)",
          value: bd.occurrence,
          detail: `${selectedZone.occRecent ?? 0} καταγραφές/3ετία · βαρύτητα 35%`,
        },
        {
          label: "Σήμα κοινότητας",
          value: bd.community,
          detail: "αναφορές + κιλά αλιέων · βαρύτητα 20%",
        },
      ]
    : null;

  return (
    <section className="panel-grid">
      <article className="info-panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lagokefalos Risk Engine · ζωντανός υπολογισμός</p>
            <h2>Risk Score {selectedZone.risk}/100 για {selectedZone.area}</h2>
          </div>
          <Gauge size={24} aria-hidden="true" />
        </div>
        {breakdownRows ? (
          <>
            <div className="breakdown-grid">
              {breakdownRows.map((row) => (
                <div className="breakdown-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="breakdown-track">
                    <i style={{ width: `${row.value ?? 0}%` }} />
                  </div>
                  <b>{row.value != null ? `${row.value}%` : "—"}</b>
                  <small style={{ gridColumn: "1 / -1", color: "var(--muted)" }}>{row.detail}</small>
                </div>
              ))}
            </div>
            <p className="notice-line" style={{ marginTop: 12 }}>
              <BrainCircuit size={16} aria-hidden="true" />
              Τύπος: Risk = 45%·SST + 35%·Παρουσία + 20%·Κοινότητα (διαφανές, χωρίς «μαύρο κουτί»).
            </p>
          </>
        ) : (
          <p>Φόρτωση ζωντανών δεδομένων για τον υπολογισμό κινδύνου…</p>
        )}
      </article>
      <article className="info-panel">
        <h3>Σύσταση περιοχής</h3>
        <p>{selectedZone.recommendation}</p>
        <div className="notice-line">
          <Megaphone size={18} aria-hidden="true" />
          {selectedZone.risk >= 80 ? "Προτείνεται ανακοίνωση φορέα." : "Συνέχιση παρακολούθησης."}
        </div>
      </article>
      <ForecastPanel forecast={forecast} />
      <SatelliteFeedsPanel />
      <AiModelStackPanel />
    </section>
  );
}

function ForecastPanel({ forecast }) {
  return (
    <article className="info-panel wide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Predictive forecast</p>
          <h3>Πρόβλεψη κινδύνου 24/48/72h</h3>
        </div>
        <TrendingUp size={22} aria-hidden="true" />
      </div>
      <div className="forecast-grid">
        {forecast.map((item) => (
          <div className="forecast-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.score}/100</strong>
            <div className="bar-track">
              <div style={{ width: `${item.score}%` }} />
            </div>
            <small>{item.reason}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function SatelliteFeedsPanel() {
  return (
    <article className="info-panel wide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Satellite data fusion</p>
          <h3>Ζωντανές πηγές δεδομένων</h3>
        </div>
        <Satellite size={22} aria-hidden="true" />
      </div>
      <div className="feed-grid">
        {satelliteFeeds.map((feed) => (
          <div className={`feed-card feed-card--${feed.status}`} key={feed.id}>
            <div>
              <strong>{feed.name}</strong>
              <span>{feed.detail}</span>
            </div>
            <div className="feed-meter">
              <i style={{ width: `${feed.signal}%` }} />
            </div>
            <small>
              <span className={`feed-badge feed-badge--${feed.status}`}>
                {feed.status === "live" ? "ΖΩΝΤΑΝΟ" : "ΕΠΟΜΕΝΗ ΦΑΣΗ"}
              </span>{" "}
              {feed.cadence}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}

function AiModelStackPanel() {
  return (
    <article className="info-panel wide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AI systems</p>
          <h3>Συνεργαζόμενα μοντέλα νοημοσύνης</h3>
        </div>
        <BrainCircuit size={22} aria-hidden="true" />
      </div>
      <div className="model-stack">
        {aiModels.map((model) => (
          <div className="model-row" key={model.name}>
            <div>
              <strong>{model.name}</strong>
              <span>{model.purpose}</span>
            </div>
            <b>{model.confidence}%</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function CitizenReportPanel({ onSubmit, selectedZone, locateUser }) {
  return (
    <section className="panel-grid">
      <form className="info-panel wide form-panel" onSubmit={onSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Πολίτης / λουόμενος</p>
            <h2>Αναφορά λαγοκέφαλου</h2>
          </div>
          <Camera size={24} aria-hidden="true" />
        </div>
        <div className="form-grid">
          <label>
            Φωτογραφία
            <input name="photo" type="file" accept="image/*" />
          </label>
          <label>
            Περιοχή / παραλία
            <input name="area" type="text" placeholder={selectedZone.area} />
          </label>
          <label>
            Το είδα
            <select name="place" defaultValue="στη θάλασσα">
              <option>στη θάλασσα</option>
              <option>έξω στην ακτή</option>
              <option>σε αλιευτικά εργαλεία</option>
            </select>
          </label>
          <label>
            Κατάσταση
            <select name="condition" defaultValue="ζωντανό">
              <option>ζωντανό</option>
              <option>νεκρό</option>
              <option>άγνωστο</option>
            </select>
          </label>
          <label>
            Υπήρξε δάγκωμα;
            <select name="bite" defaultValue="Όχι">
              <option>Όχι</option>
              <option>Ναι</option>
            </select>
          </label>
          <label className="full">
            Σχόλιο
            <textarea name="comment" rows="4" placeholder="Σύντομη περιγραφή περιστατικού" />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={locateUser}>
            <LocateFixed size={18} aria-hidden="true" />
            Αυτόματο GPS
          </button>
          <button type="submit" className="primary-action">
            <Upload size={18} aria-hidden="true" />
            Αποστολή
          </button>
        </div>
      </form>
      <article className="info-panel">
        <h3>Μετά την αποστολή</h3>
        <p>
          Η αναφορά καταχωρείται ως pending, περνά από demo AI αναγνώριση φωτογραφίας και μετά
          εμφανίζεται στο admin panel για έγκριση ή απόρριψη.
        </p>
      </article>
    </section>
  );
}

function AiResultPanel({ report }) {
  if (!report) return null;
  return (
    <section className="panel-grid">
      <article className="info-panel wide ai-result">
        <div>
          <p className="eyebrow">AI αναγνώριση φωτογραφίας</p>
          <h2>Πιθανός λαγοκέφαλος</h2>
          <strong>{report.ai}%</strong>
          <p>Κατάσταση: στάλθηκε για έλεγχο.</p>
          <p>Οδηγία: Μην το αγγίζεις, μην το μετακινείς και μην το καταναλώσεις.</p>
        </div>
        <Fish size={72} aria-hidden="true" />
      </article>
    </section>
  );
}

function FishermanPanel({ catches, onSubmit }) {
  const totalKg = catches.reduce((sum, item) => sum + Number(item.kg || 0), 0);
  const estimatedCompensation = totalKg * 5.33;

  return (
    <section className="panel-grid">
      <form className="info-panel wide form-panel" onSubmit={onSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Panel ψαρά</p>
            <h2>Νέα δήλωση αλίευσης</h2>
          </div>
          <Anchor size={24} aria-hidden="true" />
        </div>
        <div className="form-grid">
          <label>
            Όνομα σκάφους
            <input name="vessel" type="text" placeholder="π.χ. ΑΓ. ΝΙΚΟΛΑΟΣ" />
          </label>
          <label>
            Λιμάνι
            <input name="port" type="text" placeholder="π.χ. Ηράκλειο" />
          </label>
          <label>
            GPS αλίευσης
            <input name="gps" type="text" placeholder="35.12, 25.20" />
          </label>
          <label>
            Κιλά λαγοκέφαλου
            <input name="kg" type="number" min="0" step="0.1" placeholder="0" />
          </label>
          <label>
            Περιοχή
            <input name="area" type="text" placeholder="Περιοχή αλίευσης" />
          </label>
          <label>
            Φωτογραφίες
            <input name="photos" type="file" accept="image/*" multiple />
          </label>
          <label className="full">
            Ζημιές σε δίχτυα / παραγάδια
            <textarea name="damage" rows="3" placeholder="Περιγραφή ζημιάς" />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-action">
            <ClipboardCheck size={18} aria-hidden="true" />
            Υποβολή δήλωσης
          </button>
        </div>
      </form>
      <article className="info-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Pilot action calculator</p>
            <h3>Εκτίμηση διαχείρισης κιλών</h3>
          </div>
          <Fish size={22} aria-hidden="true" />
        </div>
        <div className="compensation-box">
          <span>Σύνολο δηλωμένων κιλών</span>
          <strong>{totalKg} kg</strong>
          <span>Demo καθαρή αμοιβή 5,33€/kg</span>
          <strong>{estimatedCompensation.toLocaleString("el-GR", { style: "currency", currency: "EUR" })}</strong>
        </div>
        <p>
          Η παραγωγική έκδοση θα συνδέει δήλωση, σημείο παράδοσης, έγκριση φορέα, ψύξη,
          καύση και ιστορικό πληρωμών.
        </p>
      </article>
      <DataTable title="Τελευταίες δηλώσεις αλιέων" rows={catches} type="catch" />
    </section>
  );
}

function AuthorityPanel({ sightings, catches, selectedZone, forecast, authorityAction, exportCsv, exportPdf }) {
  return (
    <section className="panel-grid">
      <article className="info-panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Dashboard φορέα</p>
            <h2>Περιοχή ελέγχου: {selectedZone.area}</h2>
          </div>
          <div className="export-actions">
            <button type="button" className="secondary-action" onClick={exportPdf}>
              <Download size={18} aria-hidden="true" />
              Export PDF
            </button>
            <button type="button" className="secondary-action" onClick={exportCsv}>
              <FileSpreadsheet size={18} aria-hidden="true" />
              Export Excel
            </button>
          </div>
        </div>
        <div className="authority-grid">
          <Metric icon={Bell} label="Σύνολο αναφορών" value={sightings.length} />
          <Metric icon={BadgeCheck} label="Επιβεβαιωμένες" value={sightings.filter((item) => item.status === "verified").length} />
          <Metric icon={Fish} label="Δηλώσεις ψαράδων" value={catches.length} />
          <Metric icon={AlertTriangle} label="Περιστατικά δαγκώματος" value={sightings.filter((item) => item.bite === "Ναι").length} tone="danger" />
        </div>
      </article>
      <AuthorityDecisionPanel selectedZone={selectedZone} forecast={forecast} authorityAction={authorityAction} />
      <DataTable title="Αναφορές πολιτών" rows={sightings} type="sighting" />
      <DataTable title="Ποσότητες ανά λιμάνι" rows={catches} type="catch" />
    </section>
  );
}

function AuthorityDecisionPanel({ selectedZone, forecast, authorityAction }) {
  return (
    <article className="info-panel wide decision-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Authority copilot</p>
          <h3>Προτεινόμενη επιχειρησιακή απόφαση</h3>
        </div>
        <Megaphone size={22} aria-hidden="true" />
      </div>
      <div className="decision-layout">
        <div>
          <span className={`action-level ${authorityAction.level}`}>{authorityAction.title}</span>
          <p>{authorityAction.reason}</p>
          <div className="alert-draft">
            <strong>Κείμενο ειδοποίησης</strong>
            <p>
              Προσοχή: {authorityAction.publicMessage} Περιοχή: {selectedZone.area}. Πρόβλεψη 72h:
              {" "}{forecast[2].score}/100. Μην αγγίζετε και μην καταναλώνετε άγνωστα ψάρια.
            </p>
          </div>
        </div>
        <div className="protocol-list">
          {authorityAction.protocol.map((step) => (
            <div key={step}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function AdminPanel({ sightings, updateSighting, pendingSightings, verifiedSightings }) {
  return (
    <section className="panel-grid">
      <article className="info-panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Admin panel</p>
            <h2>Έλεγχος αναφορών και φωτογραφιών</h2>
          </div>
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <div className="authority-grid">
          <Metric icon={ClipboardCheck} label="Pending" value={pendingSightings.length} tone="warn" />
          <Metric icon={BadgeCheck} label="Verified" value={verifiedSightings.length} />
          <Metric icon={XCircle} label="Rejected" value={sightings.filter((item) => item.status === "rejected").length} />
        </div>
      </article>
      <article className="info-panel wide">
        <div className="table-header">
          <h3>Ουρά ελέγχου</h3>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Περιοχή</th>
                <th>AI</th>
                <th>Κατάσταση</th>
                <th>Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {sightings.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.area}</td>
                  <td>{item.ai}%</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-action approve" title="Έγκριση" onClick={() => updateSighting(item.id, "verified")}>
                        <CheckCircle2 size={17} aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-action reject" title="Απόρριψη" onClick={() => updateSighting(item.id, "rejected")}>
                        <XCircle size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function DataTable({ title, rows, type }) {
  return (
    <article className="info-panel wide">
      <div className="table-header">
        <h3>{title}</h3>
      </div>
      <div className="responsive-table">
        <table>
          <thead>
            {type === "catch" ? (
              <tr>
                <th>ID</th>
                <th>Σκάφος</th>
                <th>Λιμάνι</th>
                <th>Κιλά</th>
                <th>Περιοχή</th>
                <th>Κατάσταση</th>
              </tr>
            ) : (
              <tr>
                <th>ID</th>
                <th>Περιοχή</th>
                <th>Πηγή</th>
                <th>AI</th>
                <th>Δάγκωμα</th>
                <th>Κατάσταση</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((item) =>
              type === "catch" ? (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.vessel}</td>
                  <td>{item.port}</td>
                  <td>{item.kg} kg</td>
                  <td>{item.area}</td>
                  <td>{item.status}</td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.area}</td>
                  <td>{item.source}</td>
                  <td>{item.ai}%</td>
                  <td>{item.bite}</td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{statusLabel(status)}</span>;
}

function nearestZone(coords) {
  return riskZones
    .map((zone) => ({
      ...zone,
      distance: Math.hypot(zone.coords[0] - coords[0], zone.coords[1] - coords[1])
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function normalizeAreaQuery(value) {
  return String(value ?? "")
    .toLocaleLowerCase("el-GR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .trim();
}

function findAreaZone(query) {
  const normalized = normalizeAreaQuery(query);
  if (!normalized) return null;

  return (
    riskZones.find((zone) => {
      const terms = [zone.id, zone.area, ...(areaAliases[zone.id] || [])];
      return terms.some((term) => {
        const candidate = normalizeAreaQuery(term);
        return candidate && (candidate.includes(normalized) || normalized.includes(candidate));
      });
    }) || null
  );
}

function buildForecast(zone, sightings, catches) {
  const localSightings = sightings.filter((item) => item.area.includes(zone.area.split(" ")[0])).length;
  const localKg = catches
    .filter((item) => item.area.includes(zone.area.split(" ")[0]) || item.port.includes(zone.area.split(" ")[0]))
    .reduce((sum, item) => sum + Number(item.kg || 0), 0);
  const reportPressure = Math.min(12, zone.reports48h + localSightings * 1.5);
  const catchPressure = Math.min(10, localKg / 20);
  const bitePressure = zone.bites * 4;
  const base = zone.risk + reportPressure + catchPressure + bitePressure;
  const trend = zone.risk >= 80 ? 6 : zone.risk >= 60 ? 4 : 2;
  const forecast = [
    {
      label: "24h",
      score: clampScore(base + trend),
      reason: "Συνδυασμός πρόσφατων αναφορών και θαλάσσιας θερμοκρασίας."
    },
    {
      label: "48h",
      score: clampScore(base + trend * 1.7 - 2),
      reason: "Μεταφορά πιθανότητας με ρεύματα και ιστορικό hotspots."
    },
    {
      label: "72h",
      score: clampScore(base + trend * 2.2 - 5),
      reason: "Προβολή κινδύνου με seasonality, βάθος και αλιευτικά δεδομένα."
    }
  ];
  forecast.confidence = Math.min(96, Math.round(76 + zone.reports48h * 1.2 + Math.min(10, localKg / 25)));
  forecast.recommendation =
    forecast[2].score >= 88
      ? "Άμεση ειδοποίηση"
      : forecast[2].score >= 72
        ? "Αυξημένη επιτήρηση"
        : forecast[2].score >= 50
          ? "Προληπτική παρακολούθηση"
          : "Κανονική επιτήρηση";
  return forecast;
}

function buildAuthorityAction(zone, forecast) {
  const peak = Math.max(zone.risk, ...forecast.map((item) => item.score));
  if (peak >= 88 || zone.bites > 0) {
    return {
      level: "critical",
      title: "Έκδοση άμεσης προειδοποίησης",
      publicMessage: "αυξημένη πιθανότητα παρουσίας λαγοκέφαλου και ανάγκη άμεσης προσοχής.",
      reason: "Το σύστημα συνδυάζει υψηλό risk score, επιβεβαιωμένες αναφορές και σοβαρούς δείκτες συμβάντων.",
      protocol: [
        "Ενημέρωση ναυαγοσωστών και λιμενικών αρχών",
        "Ανάρτηση προειδοποίησης σε ακτές και ψηφιακά κανάλια",
        "Επικοινωνία με αλιευτικούς συλλόγους",
        "Ενεργοποίηση καθημερινής αναφοράς φορέα"
      ]
    };
  }
  if (peak >= 70) {
    return {
      level: "high",
      title: "Αυξημένη επιτήρηση περιοχής",
      publicMessage: "αυξημένη πιθανότητα παρουσίας λαγοκέφαλου στην ευρύτερη περιοχή.",
      reason: "Η πρόβλεψη 72h δείχνει αυξητική τάση και χρειάζεται στενότερη παρακολούθηση.",
      protocol: [
        "Στοχευμένη ενημέρωση παραλιών",
        "Έλεγχος νέων φωτογραφιών από admin",
        "Συγκέντρωση δηλώσεων αλιέων",
        "Επανυπολογισμός risk score ανά 6 ώρες"
      ]
    };
  }
  return {
    level: "normal",
    title: "Συνέχιση παρακολούθησης",
    publicMessage: "χαμηλή έως μέτρια πιθανότητα, με σύσταση προσοχής.",
    reason: "Τα δορυφορικά και επιβεβαιωμένα δεδομένα δεν δείχνουν άμεση ανάγκη συναγερμού.",
    protocol: [
      "Διατήρηση κανονικής επιτήρησης",
      "Έλεγχος νέων αναφορών πολιτών",
      "Εβδομαδιαία σύνοψη φορέα",
      "Προληπτική ενημέρωση όταν αυξηθεί το score"
    ]
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function estimateImageProbability(fileName = "", condition = "", bite = "") {
  const text = `${fileName} ${condition} ${bite}`.toLowerCase();
  let score = 64;
  if (text.includes("lag") || text.includes("puffer") || text.includes("lago")) score += 16;
  if (condition === "ζωντανό") score += 6;
  if (bite === "Ναι") score += 9;
  return Math.max(51, Math.min(96, score + Math.floor(Math.random() * 12)));
}

function statusLabel(status) {
  if (status === "verified") return "επιβεβαιώθηκε";
  if (status === "rejected") return "απορρίφθηκε";
  return "σε έλεγχο";
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n");
  return `\uFEFF${headers.join(",")}\n${body}`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

createRoot(document.getElementById("root")).render(
  <LangProvider>
    <App />
  </LangProvider>
);
