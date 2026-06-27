import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import * as THREE from "three";
import {
  AlertTriangle,
  Anchor,
  Activity,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  Contrast,
  Info,
  Type,
  Volume2,
  VolumeX,
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
  Play,
  Pause,
  QrCode,
  Share2,
  Radio,
  Radar,
  Satellite,
  Search,
  ShieldCheck,
  Siren,
  Star,
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
  fetchOccurrenceHistory,
  countPointsNear,
  computeLiveZone,
  geocodeGreece,
  riskInk,
} from "./data/seaData.js";
import { BASE_ZONES, AREA_ALIASES } from "./data/zones.js";
import GreeceGlobe from "./components/GreeceGlobe.jsx";
import { LangProvider, useLang } from "./lang.jsx";
import { A11yProvider, useA11y } from "./a11y.jsx";

const riskZones = BASE_ZONES.map((z) => ({
  risk: 38,
  level: "Υπό φόρτωση",
  color: "#8a99a0",
  reports48h: 0,
  satellite: "Φόρτωση δεδομένων…",
  satelliteEn: "Loading data…",
  lastReport: "—",
  recommendation: "Φόρτωση ζωντανών δεδομένων…",
  recommendationEn: "Loading live data…",
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
    nameEn: "Open-Meteo Marine · SST",
    signal: 96,
    cadence: "ζωντανά, ανά ώρα",
    cadenceEn: "live, hourly",
    detail: "Θερμοκρασία επιφάνειας θάλασσας (πραγματικά δεδομένα)",
    detailEn: "Sea-surface temperature (real data)",
    status: "live"
  },
  {
    id: "currents",
    name: "Open-Meteo Marine · Ρεύματα & κύμα",
    nameEn: "Open-Meteo Marine · Currents & waves",
    signal: 92,
    cadence: "ζωντανά, ανά ώρα",
    cadenceEn: "live, hourly",
    detail: "Ταχύτητα/κατεύθυνση ρευμάτων και ύψος κύματος",
    detailEn: "Current speed/direction and wave height",
    status: "live"
  },
  {
    id: "gbif",
    name: "GBIF · Καταγραφές είδους",
    nameEn: "GBIF · Species records",
    signal: 90,
    cadence: "ζωντανά",
    cadenceEn: "live",
    detail: "Πραγματικές καταγραφές Lagocephalus sceleratus (iNaturalist/HCMR/μουσεία)",
    detailEn: "Real Lagocephalus sceleratus records (iNaturalist/HCMR/museums)",
    status: "live"
  },
  {
    id: "copernicus",
    name: "Copernicus Marine · χλωροφύλλη",
    nameEn: "Copernicus Marine · chlorophyll",
    signal: 60,
    cadence: "υπό ενσωμάτωση",
    cadenceEn: "being integrated",
    detail: "Βιογεωχημικά & δορυφορικά προϊόντα (επόμενη φάση)",
    detailEn: "Biogeochemical & satellite products (next phase)",
    status: "planned"
  },
  {
    id: "bathymetry",
    name: "EMODnet Bathymetry",
    nameEn: "EMODnet Bathymetry",
    signal: 55,
    cadence: "υπό ενσωμάτωση",
    cadenceEn: "being integrated",
    detail: "Βάθος, κλίση βυθού, απόσταση ακτής (επόμενη φάση)",
    detailEn: "Depth, seabed slope, distance to shore (next phase)",
    status: "planned"
  }
];

const aiModels = [
  {
    name: "Satellite Fusion AI",
    confidence: 93,
    purpose: "Συνθέτει δορυφορικές και θαλάσσιες μεταβλητές.",
    purposeEn: "Fuses satellite and marine variables."
  },
  {
    name: "Vision Recognition",
    confidence: 88,
    purpose: "Αναγνωρίζει χαρακτηριστικά λαγοκέφαλου από φωτογραφίες.",
    purposeEn: "Identifies pufferfish features from photos."
  },
  {
    name: "Hotspot Predictor",
    confidence: 91,
    purpose: "Προβλέπει πιθανές ζώνες παρουσίας 24/48/72h.",
    purposeEn: "Predicts likely presence zones at 24/48/72h."
  },
  {
    name: "Duplicate Guard",
    confidence: 86,
    purpose: "Ελέγχει διπλές, ψευδείς ή ύποπτες αναφορές.",
    purposeEn: "Flags duplicate, fake or suspicious reports."
  },
  {
    name: "Authority Copilot",
    confidence: 90,
    purpose: "Παράγει σύνοψη, ειδοποίηση και αναφορά φορέα.",
    purposeEn: "Generates summary, alert and authority report."
  }
];

const roles = [
  { id: "citizen", label: "Πολίτης / λουόμενος", labelEn: "Citizen / swimmer", icon: Users },
  { id: "fisherman", label: "Ψαράς", labelEn: "Fisherman", icon: Anchor },
  { id: "authority", label: "Δήμος / Περιφέρεια", labelEn: "Municipality / Region", icon: BarChart3 },
  { id: "admin", label: "Admin", labelEn: "Admin", icon: ShieldCheck }
];

const areaAliases = AREA_ALIASES;
const MIN_TIMELINE_YEAR = 2005; // πρώτες ελληνικές καταγραφές λαγοκέφαλου

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
  const [follows, setFollows] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sg-follows") || "[]");
    } catch {
      return [];
    }
  });
  const followNotified = useRef(false);
  const toggleFollow = (id) =>
    setFollows((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      try {
        localStorage.setItem("sg-follows", JSON.stringify(next));
      } catch {}
      return next;
    });

  // ---- Χρονομηχανή εξάπλωσης (GBIF ιστορικό) ----
  const nowYear = new Date().getFullYear();
  const [timelineActive, setTimelineActive] = useState(false);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [timelineYear, setTimelineYear] = useState(nowYear);
  const [playing, setPlaying] = useState(false);
  const historyLoadedRef = useRef(false);

  const toggleTimeline = async () => {
    const next = !timelineActive;
    setTimelineActive(next);
    if (next && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      setHistoryLoading(true);
      try {
        const h = await fetchOccurrenceHistory();
        setHistoryPoints(h);
        setTimelineYear(MIN_TIMELINE_YEAR);
        setPlaying(true);
      } catch {
        // αν αποτύχει, χρησιμοποιούμε τα τρέχοντα σημεία
      }
      setHistoryLoading(false);
    } else if (next) {
      setTimelineYear(MIN_TIMELINE_YEAR);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  };

  useEffect(() => {
    if (!timelineActive || !playing) return undefined;
    const id = setInterval(() => {
      setTimelineYear((y) => (y >= nowYear ? MIN_TIMELINE_YEAR : y + 1));
    }, 900);
    return () => clearInterval(id);
  }, [timelineActive, playing, nowYear]);

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
        setLiveError(t("Δεν ήταν δυνατή η σύνδεση με τις πηγές δεδομένων. Πάτησε «Ανανέωση» για να ξαναδοκιμάσεις.", "Couldn't reach the data sources. Tap “Refresh” to try again."));
      } else {
        setLiveStatus("ready");
      }
    } catch (e) {
      if (aliveRef.current) {
        setLiveStatus("error");
        setLiveError(t("Σφάλμα φόρτωσης ζωντανών δεδομένων. Πάτησε «Ανανέωση» για να ξαναδοκιμάσεις.", "Error loading live data. Tap “Refresh” to try again."));
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

  // Deep-link: ?zone=<id> ή ?q=<περιοχή> ή ?lang=el|en → άνοιγμα κατευθείαν στη σωστή παραλία
  const pendingSearchRef = useRef(null);
  const deepLinkRef = useRef(false);
  useEffect(() => {
    if (deepLinkRef.current) return;
    deepLinkRef.current = true;
    try {
      const p = new URLSearchParams(window.location.search);
      const ln = p.get("lang");
      if (ln === "en" || ln === "el") setLang(ln);
      const z = p.get("zone");
      const q = p.get("q");
      if (z && riskZones.some((rz) => rz.id === z)) {
        setSelectedZoneId(z);
        setActivePanel("map");
      } else if (q) {
        setAreaQuery(q);
        pendingSearchRef.current = q;
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (liveStatus === "ready" && pendingSearchRef.current) {
      pendingSearchRef.current = null;
      handleAreaSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStatus]);

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
      // 🟣 «Επιβεβαιωμένη παρουσία»: υπάρχουν πραγματικές καταγραφές GBIF στην 3ετία
      const confirmed = (computed.occRecent || 0) > 0;
      // «live» μόνο αν έχουμε ΠΡΑΓΜΑΤΙΚΟ σήμα (SST ή καταγραφή). Αλλιώς δεν δείχνουμε
      // εφευρεμένο σκορ — η ζώνη μένει γκρι «Δεν φορτώθηκε».
      const hasSignal = raw.marine?.sst != null || (computed.occRecent || 0) > 0;
      return {
        ...zone,
        ...computed,
        confirmed,
        live: hasSignal,
        ...(hasSignal ? {} : { color: "#8a99a0" }),
      };
    });
  }, [rawByZone, sightings, catches]);

  // Ζώνες προς εμφάνιση = προκαθορισμένες + (προαιρετικά) η ad-hoc περιοχή αναζήτησης
  const displayZones = useMemo(
    () => (searchResult ? [...liveZones, searchResult] : liveZones),
    [liveZones, searchResult]
  );

  const selectedZone = displayZones.find((zone) => zone.id === selectedZoneId) || displayZones[0];
  const notLive = selectedZone?.live === false; // δεν δείχνουμε εφευρεμένο σκορ όταν λείπουν δεδομένα
  const followedZones = liveZones.filter((z) => follows.includes(z.id));
  // Σημεία χάρτη: ιστορικά (φιλτραρισμένα έως το έτος) όταν τρέχει η χρονομηχανή, αλλιώς τα τρέχοντα
  const mapPoints = timelineActive
    ? historyPoints.filter((p) => p.year && p.year <= timelineYear)
    : realPoints;

  // Ειδοποίηση: αν μια ακολουθούμενη παραλία είναι σε υψηλό κίνδυνο/επιβεβαιωμένη → notification (μία φορά/session)
  useEffect(() => {
    if (liveStatus !== "ready" || followNotified.current) return;
    const risky = followedZones.filter((z) => z.risk >= 66 || z.confirmed);
    if (!risky.length) return;
    followNotified.current = true;
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const names = risky.map((z) => z.area).slice(0, 4).join(", ");
        new Notification("EV SEA GUARD AI", {
          body:
            lang === "en"
              ? `⚠️ High pufferfish risk at your beaches: ${names}`
              : `⚠️ Υψηλός κίνδυνος λαγοκέφαλου στις παραλίες σου: ${names}`,
          icon: `${import.meta.env.BASE_URL}icon-192.png`,
        });
      } catch {}
    }
  }, [liveStatus, followedZones, lang]);

  // Επίπεδο κινδύνου δίγλωσσο (EN από το risk score, EL από το έτοιμο label)
  const lvl = (z) => {
    if (!z.live)
      return liveStatus === "loading"
        ? lang === "el" ? "Φόρτωση…" : "Loading…"
        : lang === "el" ? "Δεν φορτώθηκε" : "Not loaded";
    if (lang === "el") return z.level;
    const r = z.risk;
    return r >= 82 ? "Critical" : r >= 66 ? "High" : r >= 48 ? "Moderate-high" : r >= 30 ? "Moderate" : "Low";
  };
  const verifiedSightings = sightings.filter((item) => item.status === "verified");
  const pendingSightings = sightings.filter((item) => item.status === "pending");
  const totalKg = catches.reduce((sum, item) => sum + Number(item.kg || 0), 0);
  const severeZones = displayZones.filter((zone) => zone.live && zone.risk >= 80).length;
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
      setAreaSearchNotice(t("Η συσκευή δεν δίνει τοποθεσία. Δείχνουμε την Κω ως παράδειγμα.", "Your device has no location. Showing Kos as an example."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setUserPosition(coords);
        const nearest = nearestZone(coords);
        setSelectedZoneId(nearest.id);
        setAreaQuery(nearest.area);
        setAreaSearchNotice(t(`Βρέθηκε κοντινή ζώνη: ${nearest.area}.`, `Nearest zone found: ${nearest.area}.`));
      },
      () => {
        setUserPosition([36.893, 27.288]);
        setSelectedZoneId("kos");
        setAreaQuery("Κως");
        setAreaSearchNotice(t("Δεν πήραμε τοποθεσία (GPS). Δείχνουμε την Κω ως παράδειγμα.", "Couldn't get your location (GPS). Showing Kos as an example."));
      },
      { enableHighAccuracy: true, timeout: 4500 }
    );
  }

  async function handleAreaSearch(event) {
    event?.preventDefault?.();
    const q = areaQuery.trim();
    if (!q) return;
    const match = findAreaZone(q);

    // 1) Προκαθορισμένη ζώνη (άμεσο)
    if (match) {
      setSearchResult(null);
      const liveMatch = liveZones.find((z) => z.id === match.id) || match;
      setSelectedZoneId(match.id);
      setAreaQuery(match.area);
      const r = liveMatch.live === false || liveMatch.risk == null ? null : liveMatch.risk;
      setAreaSearchNotice(
        r == null
          ? t(`Φόρτωση δεδομένων για ${match.area}…`, `Loading data for ${match.area}…`)
          : t(`Αποτέλεσμα για ${match.area}: Δείκτης κινδύνου ${r}/100.`, `Result for ${match.area}: Risk score ${r}/100.`)
      );
      setActivePanel("map");
      return;
    }

    // 2) Geocoding fallback — ΟΠΟΙΑΔΗΠΟΤΕ ελληνική παράκτια περιοχή/παραλία
    setAreaSearchNotice(t(`Αναζήτηση «${q}»…`, `Searching "${q}"…`));
    try {
      const geo = await geocodeGreece(q);
      if (!geo) {
        setAreaSearchNotice(t(`Δεν βρέθηκε «${q}». Δοκίμασε όνομα παράκτιας περιοχής ή νησιού της Ελλάδας.`, `No match for "${q}". Try a Greek coastal area or island name.`));
        return;
      }
      const marine = await fetchMarine(geo.lat, geo.lon).catch(() => null);
      // Απόρριψη μη-παράκτιων σημείων: χωρίς θαλάσσια SST δεν υπάρχει «θαλάσσιος κίνδυνος»
      if (!marine || marine.sst == null) {
        setAreaSearchNotice(t(`Το «${geo.name}» δεν φαίνεται παράκτια περιοχή. Δοκίμασε παραλία, λιμάνι ή νησί.`, `"${geo.name}" doesn't look like a coastal area. Try a beach, port or island.`));
        return;
      }
      const recent = countPointsNear(realPoints, geo.lat, geo.lon);
      const computed = computeLiveZone({ marine, occ: { recent, total: recent } });
      const result = {
        id: "__search",
        area: geo.name,
        region: geo.admin || (lang === "en" ? "Search" : "Αναζήτηση"),
        coords: [geo.lat, geo.lon],
        reports48h: 0,
        kg7d: 0,
        bites: 0,
        ...computed,
        confirmed: (computed.occRecent || 0) > 0,
        live: true,
      };
      setSearchResult(result);
      setSelectedZoneId("__search");
      setAreaQuery(geo.name);
      setAreaSearchNotice(t(`Αποτέλεσμα για ${geo.name}: Δείκτης κινδύνου ${computed.risk}/100.`, `Result for ${geo.name}: Risk score ${computed.risk}/100.`));
      setActivePanel("map");
    } catch {
      setAreaSearchNotice(t("Δεν ήταν δυνατή η αναζήτηση αυτή τη στιγμή. Δοκίμασε ξανά.", "Search isn't available right now. Please try again."));
    }
  }

  function quickSelectArea(zoneId) {
    const zone = liveZones.find((item) => item.id === zoneId);
    if (!zone) return;
    setSearchResult(null);
    setSelectedZoneId(zone.id);
    setAreaQuery(zone.area);
    const r = zone.live === false || zone.risk == null ? null : zone.risk;
    setAreaSearchNotice(
      r == null
        ? t(`Φόρτωση δεδομένων για ${zone.area}…`, `Loading data for ${zone.area}…`)
        : t(`Αποτέλεσμα για ${zone.area}: Δείκτης κινδύνου ${r}/100.`, `Result for ${zone.area}: Risk score ${r}/100.`)
    );
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
    const rep = lang === "en"
      ? { title: "Area Report", area: "Area", lvl: "Level", h: ["ID", "Area", "Source", "AI", "Status", "Time"] }
      : { title: "Αναφορά Περιοχής", area: "Περιοχή", lvl: "Επίπεδο", h: ["ID", "Περιοχή", "Πηγή", "AI", "Κατάσταση", "Ώρα"] };
    const levelText = lvl(selectedZone);
    const recText = lang === "en" && selectedZone.recommendationEn ? selectedZone.recommendationEn : selectedZone.recommendation;
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>EV SEA GUARD AI ${escapeHtml(rep.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#10202a}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ccd6dd;padding:8px;text-align:left}th{background:#edf6f8}.risk{font-weight:700;color:#b51d1d}</style></head><body><h1>EV SEA GUARD AI - ${escapeHtml(rep.title)}</h1><p>${escapeHtml(rep.area)}: <strong>${escapeHtml(selectedZone.area)}</strong> | Risk score: <span class="risk">${selectedZone.risk}/100</span> | ${escapeHtml(rep.lvl)}: ${escapeHtml(levelText)}</p><p>${escapeHtml(recText)}</p><table><thead><tr>${rep.h.map((x) => `<th>${escapeHtml(x)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank", "width=960,height=720");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      // Popup μπλοκαρισμένο: κατέβασε το HTML ως αρχείο για εκτύπωση/PDF
      downloadBlob(html, "ev-sea-guard-ai-report.html", "text/html;charset=utf-8");
      alert(t("Το αναδυόμενο παράθυρο μπλοκαρίστηκε. Κατεβάσαμε την αναφορά ως αρχείο HTML — άνοιξέ το και τύπωσέ το σε PDF.", "The pop-up was blocked. We downloaded the report as an HTML file — open it and print it to PDF."));
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={t("Κύρια πλοήγηση", "Main navigation")}>
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

        <a className="sidebar-credit" href="https://evlabsai.gr" target="_blank" rel="noopener noreferrer" aria-label="EV LABS AI — evlabsai.gr">
          <span className="sidebar-credit-by">powered by</span>
          <strong>EV LABS AI</strong>
          <span className="sidebar-credit-site">evlabsai.gr</span>
        </a>
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
            <AccessibilityBar />
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
          follows={follows}
          onToggleFollow={toggleFollow}
        />

        <MyBeaches
          zones={followedZones}
          onSelect={(id) => {
            setSearchResult(null);
            setSelectedZoneId(id);
          }}
          onRemove={toggleFollow}
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
          <Metric icon={Gauge} label={t("Δείκτης κινδύνου", "Risk score")} value={notLive ? "—" : `${selectedZone.risk}/100`} tone={!notLive && selectedZone.risk >= 80 ? "danger" : "warn"} />
          <Metric
            icon={Waves}
            label={t("Θερμοκρασία θάλασσας (SST)", "Sea temperature (SST)")}
            value={selectedZone.sst != null ? `${selectedZone.sst.toFixed(1)}°C` : "—"}
            tone={selectedZone.sst != null && selectedZone.sst >= 24 ? "danger" : "default"}
          />
          <Metric icon={TrendingUp} label={t("Πρόβλεψη 72h", "72h forecast")} value={notLive ? "—" : `${forecast[2].score}/100`} tone={!notLive && forecast[2].score >= 80 ? "danger" : "warn"} />
          <Metric icon={BrainCircuit} label={t("Κάλυψη δεδομένων", "Data coverage")} value={notLive ? "—" : `${forecast.confidence}%`} />
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
                `Γαλάζιες κουκκίδες = πραγματικές καταγραφές GBIF (${mapPoints.length}). Κύκλοι = ζώνες με ζωντανό Δείκτη κινδύνου.`,
                `Blue dots = real GBIF records (${mapPoints.length}). Circles = zones with a live risk score.`
              )}
            </p>

            <SpreadTimeline
              active={timelineActive}
              onToggle={toggleTimeline}
              year={timelineYear}
              setYear={setTimelineYear}
              minYear={MIN_TIMELINE_YEAR}
              maxYear={nowYear}
              count={mapPoints.length}
              loading={historyLoading}
              playing={playing}
              onPlayToggle={() => setPlaying((p) => !p)}
            />

            <div className="risk-map-wrap">
            <MapContainer center={[38.1, 24.1]} zoom={6} scrollWheelZoom={false} className="risk-map">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToZone zone={selectedZone} />
              {mapPoints.map((pt, index) => (
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
              {displayZones.filter((z) => z.confirmed).map((zone) => (
                <CircleMarker
                  key={`conf-${zone.id}`}
                  center={zone.coords}
                  radius={14 + zone.risk / 8}
                  pathOptions={{ color: "#b14fff", fill: false, weight: 2.5, dashArray: "4 3" }}
                  interactive={false}
                />
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
                  radius={10 + (zone.live === false ? 0 : zone.risk) / 8}
                  eventHandlers={{ click: () => setSelectedZoneId(zone.id) }}
                >
                  <Popup>
                    <strong>{zone.area}</strong>
                    <br />
                    {t("Δείκτης κινδύνου", "Risk score")}: {zone.live === false ? "—" : `${zone.risk}/100`} · {lvl(zone)}
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
            <MapSatelliteOverlay />
            </div>
          </section>

          <aside className="zone-panel" aria-label={t("Κάρτα περιοχής", "Area card")}>
            <div className="zone-head">
              <div>
                <p className="eyebrow">{t("Περιοχή", "Area")}</p>
                <h2>{selectedZone.area}</h2>
              </div>
              <span className="risk-pill" style={{ backgroundColor: selectedZone.color, color: riskInk(selectedZone.color) }}>
                {lvl(selectedZone)}
              </span>
            </div>
            {selectedZone.confirmed && (
              <div
                className="confirmed-flag"
                title={t(
                  `${selectedZone.occRecent} επιβεβαιωμένες επιστημονικές καταγραφές κοντά εδώ τα τελευταία 3 χρόνια (πηγή: GBIF).`,
                  `${selectedZone.occRecent} confirmed scientific records near here in the last 3 years (source: GBIF).`
                )}
              >
                <span className="confirmed-dot" aria-hidden="true" />
                {t("Επιβεβαιωμένη παρουσία λαγοκέφαλου", "Confirmed pufferfish presence")}
                <b>{selectedZone.occRecent}</b>
              </div>
            )}
            <div className="risk-score">
              <span>{selectedZone.live === false ? "—" : selectedZone.risk}</span>
              <small>/100</small>
            </div>
            <SafetyVerdict zone={selectedZone} />
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
                <dt>{t("Θάλασσα σήμερα", "Sea today")}</dt>
                <dd>
                  {selectedZone.wave != null ? `🌊 ${selectedZone.wave.toFixed(1)} m` : "—"}
                  {selectedZone.currentVel != null ? ` · ${t("ρεύμα", "current")} ${selectedZone.currentVel.toFixed(1)} km/h` : ""}
                </dd>
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
              {selectedZone.id !== "__search" && (
                <FollowStar active={follows.includes(selectedZone.id)} onClick={() => toggleFollow(selectedZone.id)} />
              )}
              <ShareButton zone={selectedZone} />
              <QrButton zone={selectedZone} />
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
              onOpenMonitor={() => setActivePanel("monitor")}
            />
          )}
          {activePanel === "admin" && (
            <AdminPanel sightings={sightings} updateSighting={updateSighting} pendingSightings={pendingSightings} verifiedSightings={verifiedSightings} />
          )}
          {activePanel === "about" && <AboutPanel />}
        </section>

        <footer className="ev-footer">
          <div className="ev-footer-brand">
            <Waves size={18} aria-hidden="true" />
            <div>
              <strong>EV SEA GUARD AI</strong>
              <span>
                {t("Μια δημιουργία της", "Created by")}{" "}
                <a className="brand-link" href="https://evlabsai.gr" target="_blank" rel="noopener noreferrer"><b>EV LABS AI</b> · evlabsai.gr</a>
              </span>
            </div>
          </div>
          <p className="ev-footer-note">
            {t(
              "Ψηφιακή υποδομή θαλάσσιας προστασίας για τον λαγοκέφαλο. Πραγματικά δεδομένα: Open-Meteo Marine + GBIF. Δεν αντικαθιστά την επίσημη ενημέρωση — σε επείγον καλέστε 112.",
              "Digital marine-protection infrastructure for the pufferfish. Real data: Open-Meteo Marine + GBIF. Not a substitute for official information — in an emergency call 112."
            )}
          </p>
          <div className="footer-links">
            <button type="button" className="footer-about-link" onClick={() => goToPanel("about")}>
              <Database size={15} aria-hidden="true" />
              {t("Πηγές & Μεθοδολογία", "Sources & Methodology")}
            </button>
            <a className="footer-about-link support" href={STRIPE_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              <Star size={15} aria-hidden="true" fill="currentColor" />
              {t("Στήριξε με €0,99", "Support €0.99")}
            </a>
          </div>
          <p className="ev-footer-copy">© {new Date().getFullYear()} EV LABS AI — {t("Όλα τα δικαιώματα κατοχυρωμένα.", "All rights reserved.")}</p>
        </footer>
      </main>
      <ScrollDots />
      <LocationAlert zones={displayZones} realPoints={realPoints} />
      <SosButton />
      {activePanel === "monitor" && (
        <AuthorityMonitor
          zones={displayZones}
          realPoints={realPoints}
          sightings={sightings}
          onExit={() => setActivePanel("authority")}
          onRefresh={loadLiveData}
        />
      )}
    </div>
  );
}

function AboutPanel() {
  const { t } = useLang();
  const spoken = t(
    "Πηγές και μεθοδολογία. Ο δείκτης κινδύνου συνδυάζει 45 τοις εκατό θερμοκρασία θάλασσας, 35 τοις εκατό πραγματικές επιστημονικές καταγραφές και 20 τοις εκατό αναφορές κοινότητας. Τα δεδομένα είναι πραγματικά, από Open-Meteo Marine και GBIF. Η εφαρμογή είναι εργαλείο ενημέρωσης, δεν είναι επίσημη αρχή. Σε επείγον κάλεσε 112. Ποτέ μην τρως ή αγγίζεις άγνωστο ψάρι.",
    "Sources and methodology. The risk score combines 45 percent sea temperature, 35 percent real scientific records and 20 percent community reports. The data is real, from Open-Meteo Marine and GBIF. This app is an information tool, not an official authority. In an emergency call 112. Never eat or touch an unfamiliar fish."
  );
  return (
    <article className="info-panel wide about-panel">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">{t("Διαφάνεια", "Transparency")}</p>
          <h3>{t("Πηγές & Μεθοδολογία", "Sources & Methodology")}</h3>
        </div>
        <Database size={22} aria-hidden="true" />
      </header>

      <p className="about-lead">
        {t(
          "Κάθε αριθμός εδώ προέρχεται από πραγματικά, ανοιχτά δεδομένα. Δες πώς υπολογίζουμε τον κίνδυνο, από πού αντλούμε τα στοιχεία και τι ΔΕΝ είμαστε.",
          "Every number here comes from real, open data. See how we calculate the risk, where the data comes from, and what we are NOT."
        )}
      </p>

      <section className="about-block">
        <h4>{t("Πώς υπολογίζεται ο κίνδυνος", "How the risk is calculated")}</h4>
        <div className="formula-row">
          <span className="formula-chip sst">45% · {t("Θερμοκρασία θάλασσας", "Sea temperature")}</span>
          <span className="formula-chip occ">35% · {t("Επιστημονικές καταγραφές", "Scientific records")}</span>
          <span className="formula-chip com">20% · {t("Αναφορές κοινότητας", "Community reports")}</span>
        </div>
        <p>
          {t(
            "Ο λαγοκέφαλος ευνοείται σε θερμά νερά (κορύφωση 22–28°C). Συνδυάζουμε τη ζωντανή θερμοκρασία θάλασσας με τις επιστημονικές καταγραφές παρουσίας και τις αναφορές πολιτών, σε έναν διαφανή σταθμισμένο δείκτη 0–100.",
            "The pufferfish thrives in warm water (peak 22–28°C). We combine live sea temperature with scientific presence records and citizen reports into a transparent weighted score of 0–100."
          )}
        </p>
      </section>

      <section className="about-block">
        <h4>{t("Από πού έρχονται τα δεδομένα", "Where the data comes from")}</h4>
        <ul className="source-links">
          <li>
            <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noopener noreferrer">Open-Meteo Marine</a>
            {" — "}
            {t("ζωντανή θερμοκρασία θάλασσας, ρεύματα, κύμα & πρόγνωση 72 ωρών.", "live sea temperature, currents, waves & 72-hour forecast.")}
          </li>
          <li>
            <a href="https://www.gbif.org/species/2407758" target="_blank" rel="noopener noreferrer">GBIF</a>
            {" — "}
            {t("πραγματικές επιστημονικές καταγραφές του Lagocephalus sceleratus (κωδικός είδους 2407758).", "real scientific records of Lagocephalus sceleratus (species key 2407758).")}
          </li>
          <li>
            <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener noreferrer">Open-Meteo Geocoding</a>
            {" — "}
            {t("εύρεση οποιασδήποτε ελληνικής παράκτιας περιοχής.", "lookup for any Greek coastal area.")}
          </li>
        </ul>
      </section>

      <section className="about-block">
        <h4>{t("Λίγη επιστήμη", "A little science")}</h4>
        <p>
          {t(
            "Ο λαγοκέφαλος (Lagocephalus sceleratus) είναι λεσσεψιανός εισβολέας μέσω της διώρυγας του Σουέζ. 1η μεσογειακή καταγραφή: κόλπος Gökova (ΝΔ Τουρκία), 2003 · ελληνικά νερά ~2005. Περιέχει τετροδοτοξίνη — θανατηφόρα, ανθεκτική στο μαγείρεμα.",
            "The pufferfish (Lagocephalus sceleratus) is a Lessepsian invader via the Suez Canal. First Mediterranean record: Gökova Bay (SW Turkey), 2003 · Greek waters ~2005. It contains tetrodotoxin — lethal and heat-resistant."
          )}
        </p>
      </section>

      <div className="about-disclaimer">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <strong>{t("Σημαντικό", "Important")}</strong>
          <p>
            {t(
              "Η εφαρμογή είναι εργαλείο ενημέρωσης — ΔΕΝ είναι επίσημη αρχή και δεν αντικαθιστά τις οδηγίες των αρχών. Σε επείγον κάλεσε 112. ΠΟΤΕ μην τρως ή αγγίζεις άγνωστο ψάρι.",
              "This app is an information tool — it is NOT an official authority and does not replace guidance from the authorities. In an emergency call 112. NEVER eat or touch an unfamiliar fish."
            )}
          </p>
        </div>
      </div>

      <div className="about-contact">
        <span>{t("Επικοινωνία", "Contact")}:</span>
        <a href="mailto:info@evlabsai.gr">info@evlabsai.gr</a>
        <span aria-hidden="true">·</span>
        <a href="https://evlabsai.gr" target="_blank" rel="noopener noreferrer">evlabsai.gr</a>
      </div>

      <ReadAloudButton text={spoken} compact />
    </article>
  );
}

const SCROLL_SECTIONS = [
  { sel: ".topbar", label: "Αρχή", labelEn: "Top" },
  { sel: ".area-search-panel", label: "Περιοχή", labelEn: "Area" },
  { sel: ".mission-theater", label: "Δορυφόρος AI", labelEn: "Satellite AI" },
  { sel: ".invasion-map", label: "Χάρτης Ελλάδας", labelEn: "Greece map" },
  { sel: ".metrics-grid", label: "Δείκτες", labelEn: "Metrics" },
  { sel: ".workspace-grid", label: "Ζώνες χάρτη", labelEn: "Map zones" },
  { sel: ".content-switcher", label: "Ενότητες", labelEn: "Sections" },
];

function ScrollDots() {
  const { t, lang } = useLang();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const elsRef = useRef([]);

  useEffect(() => {
    const found = SCROLL_SECTIONS.map((s) => ({ label: lang === "en" ? s.labelEn : s.label, el: document.querySelector(s.sel) })).filter(
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
  }, [lang]);

  const goTo = (i) => {
    const target = elsRef.current[i];
    if (target?.el) target.el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (items.length < 2) return null;

  return (
    <nav className="scroll-rail" aria-label={t("Πλοήγηση ενοτήτων", "Section navigation")}>
      <button
        type="button"
        className="scroll-arrow"
        onClick={() => goTo(Math.max(0, active - 1))}
        disabled={active === 0}
        aria-label={t("Προηγούμενη ενότητα", "Previous section")}
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
        aria-label={t("Επόμενη ενότητα", "Next section")}
      >
        <ChevronDown size={16} />
      </button>
    </nav>
  );
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Ειδοποίηση τοποθεσίας: αν ο χρήστης είναι κοντά σε καταγραφή/περιοχή λαγοκέφαλου → ALERT
function LocationAlert({ zones, realPoints }) {
  const { t } = useLang();
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("sg-geo") === "1";
    } catch {
      return false;
    }
  });
  const [pos, setPos] = useState(null);
  const [alert, setAlert] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const watchRef = useRef(null);
  const lastNotif = useRef(0);

  const enable = async () => {
    if (!navigator.geolocation) {
      window.alert(t("Η συσκευή σου δεν υποστηρίζει εντοπισμό θέσης.", "Your device doesn't support location."));
      return;
    }
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch {}
    setEnabled(true);
    try {
      localStorage.setItem("sg-geo", "1");
    } catch {}
  };
  const disable = () => {
    setEnabled(false);
    setAlert(null);
    try {
      localStorage.setItem("sg-geo", "0");
    } catch {}
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
  };

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [enabled]);

  useEffect(() => {
    if (!pos) return;
    let nearRecord = Infinity;
    for (const pt of realPoints) {
      const d = haversineKm(pos[0], pos[1], pt.lat, pt.lng);
      if (d < nearRecord) nearRecord = d;
    }
    let nz = null;
    let nd = Infinity;
    for (const z of zones) {
      if (!z.coords) continue;
      const d = haversineKm(pos[0], pos[1], z.coords[0], z.coords[1]);
      if (d < nd) {
        nd = d;
        nz = z;
      }
    }
    let a = null;
    if (nearRecord <= 4) a = { level: "record", area: nz?.area, risk: nz?.risk };
    else if (nz && nz.risk >= 66 && nd <= 25) a = { level: "high", area: nz.area, risk: nz.risk };
    setAlert(a);
    if (a) setDismissed(false);
    if (a && "Notification" in window && Notification.permission === "granted" && Date.now() - lastNotif.current > 600000) {
      lastNotif.current = Date.now();
      try {
        new Notification("EV SEA GUARD AI", {
          body:
            a.level === "record"
              ? t(`⚠️ Λαγοκέφαλος έχει καταγραφεί κοντά σου (${a.area}). Μην αγγίζεις άγνωστα ψάρια.`, `⚠️ Pufferfish recorded near you (${a.area}). Don't touch unfamiliar fish.`)
              : t(`⚠️ Είσαι σε περιοχή υψηλού κινδύνου λαγοκέφαλου (${a.area}).`, `⚠️ You are in a high-risk pufferfish area (${a.area}).`),
          icon: `${import.meta.env.BASE_URL}icon-192.png`,
        });
      } catch {}
    }
  }, [pos, zones, realPoints]);

  return (
    <>
      {alert && !dismissed && (
        <div className={`geo-alert geo-alert--${alert.level}`} role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <div className="geo-alert-text">
            <strong>
              {alert.level === "record"
                ? t("Προσοχή! Λαγοκέφαλος έχει καταγραφεί κοντά σου", "Warning! Pufferfish recorded near you")
                : t("Προσοχή! Είσαι σε περιοχή υψηλού κινδύνου", "Warning! You are in a high-risk area")}
            </strong>
            <span>
              {alert.area}
              {alert.risk != null ? ` · ${alert.risk}/100` : ""} — {t("Μην αγγίζεις άγνωστα ψάρια. Μην τα τρως.", "Don't touch unfamiliar fish. Don't eat them.")}
            </span>
          </div>
          <a href="tel:112" className="geo-alert-sos">112</a>
          <button type="button" className="geo-alert-x" onClick={() => setDismissed(true)} aria-label={t("Κλείσιμο", "Close")}>
            <XCircle size={20} />
          </button>
        </div>
      )}
      <button
        type="button"
        className={`geo-toggle ${enabled ? "on" : ""}`}
        onClick={() => (enabled ? disable() : enable())}
        aria-pressed={enabled}
      >
        <LocateFixed size={15} aria-hidden="true" />
        {enabled ? t("Ειδοποίηση: ΟΝ", "Alerts: ON") : t("Ειδοποίηση τοποθεσίας", "Location alerts")}
      </button>
    </>
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

function SpreadTimeline({ active, onToggle, year, setYear, minYear, maxYear, count, loading, playing, onPlayToggle }) {
  const { t } = useLang();
  return (
    <div className={`timeline ${active ? "on" : ""}`}>
      <button type="button" className={`timeline-toggle ${active ? "on" : ""}`} onClick={onToggle}>
        <Clock3 size={16} aria-hidden="true" /> {t("Χρονομηχανή εξάπλωσης", "Spread timeline")}
        <span className="timeline-sub">{t("δες την εισβολή από το 2005", "see the invasion since 2005")}</span>
      </button>
      {active && (
        <div className="timeline-controls">
          <button
            type="button"
            className="timeline-play"
            onClick={onPlayToggle}
            aria-label={playing ? t("Παύση", "Pause") : t("Αναπαραγωγή", "Play")}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="timeline-range"
            aria-label={t("Έτος", "Year")}
          />
          <span className="timeline-year">{loading ? "…" : year}</span>
          <span className="timeline-count">{count} {t("καταγραφές", "records")}</span>
        </div>
      )}
    </div>
  );
}

function ShareButton({ zone }) {
  const { t, lang } = useLang();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const baseUrl = "https://lagokefalos.evlabsai.gr/";
    const param = zone.id === "__search" ? `q=${encodeURIComponent(zone.area)}` : `zone=${zone.id}`;
    const url = `${baseUrl}?${param}&lang=${lang}`;
    const text =
      lang === "en"
        ? `🐡 ${zone.area}: pufferfish risk ${zone.risk}/100. Check it live:`
        : `🐡 ${zone.area}: κίνδυνος λαγοκέφαλου ${zone.risk}/100. Δες το ζωντανά:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "EV SEA GUARD AI", text, url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };
  return (
    <button type="button" className="secondary-action" onClick={share}>
      <Share2 size={18} aria-hidden="true" />
      {copied ? t("Αντιγράφηκε!", "Copied!") : t("Κοινοποίηση", "Share")}
    </button>
  );
}

function QrButton({ zone }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const link = `https://lagokefalos.evlabsai.gr/?${
    zone.id === "__search" ? `q=${encodeURIComponent(zone.area)}` : `zone=${zone.id}`
  }&lang=${lang}`;
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setDataUrl("");
    import("qrcode")
      .then((mod) => (mod.default || mod).toDataURL(link, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0b3d4d", light: "#ffffff" },
      }))
      .then((u) => {
        if (alive) setDataUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, link]);
  return (
    <>
      <button type="button" className="secondary-action" onClick={() => setOpen(true)}>
        <QrCode size={18} aria-hidden="true" />
        {t("Κωδικός QR", "QR code")}
      </button>
      {open && (
        <div className="qr-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="qr-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="qr-x" onClick={() => setOpen(false)} aria-label={t("Κλείσιμο", "Close")}>
              <XCircle size={22} aria-hidden="true" />
            </button>
            <span className="qr-kicker">EV SEA GUARD AI</span>
            <h3>{zone.area}</h3>
            <p>{t("Σκάναρε για ζωντανό κίνδυνο λαγοκέφαλου σε αυτή την παραλία.", "Scan for the live pufferfish risk at this beach.")}</p>
            {dataUrl ? (
              <img src={dataUrl} alt={t("Κωδικός QR παραλίας", "Beach QR code")} className="qr-img" />
            ) : (
              <div className="qr-loading" aria-hidden="true" />
            )}
            <div className="qr-actions">
              {dataUrl && (
                <a className="primary-action" href={dataUrl} download={`SeaGuard-${zone.id === "__search" ? "search" : zone.id}.png`}>
                  <Download size={18} aria-hidden="true" />
                  {t("Κατέβασε QR (αφίσα)", "Download QR (poster)")}
                </a>
              )}
            </div>
            <p className="qr-hint">{t("Ιδανικό για πινακίδες Δήμων, ξενοδοχεία & beach bar.", "Ideal for municipal signage, hotels & beach bars.")}</p>
          </div>
        </div>
      )}
    </>
  );
}

function AccessibilityBar() {
  const { t } = useLang();
  const { contrast, toggleContrast, bumpScale, scale } = useA11y();
  return (
    <div className="a11y-bar" role="group" aria-label={t("Προσβασιμότητα", "Accessibility")}>
      <button
        type="button"
        className={`a11y-btn ${contrast ? "on" : ""}`}
        onClick={toggleContrast}
        aria-pressed={contrast}
        title={t("Υψηλή αντίθεση (χαμηλή όραση)", "High contrast (low vision)")}
      >
        <Contrast size={16} aria-hidden="true" />
        <span>{t("Αντίθεση", "Contrast")}</span>
      </button>
      <div className="a11y-scale" role="group" aria-label={t("Μέγεθος γραμμάτων", "Text size")}>
        <Type size={15} aria-hidden="true" />
        <button type="button" className="a11y-btn icon" onClick={() => bumpScale(-1)} disabled={scale <= 1} aria-label={t("Μικρότερα γράμματα", "Smaller text")}>Α−</button>
        <button type="button" className="a11y-btn icon" onClick={() => bumpScale(1)} disabled={scale >= 1.3} aria-label={t("Μεγαλύτερα γράμματα", "Larger text")}>Α+</button>
      </div>
    </div>
  );
}

function ReadAloudButton({ text, compact }) {
  const { t, lang } = useLang();
  const { speak, stopSpeak, speaking } = useA11y();
  return (
    <button
      type="button"
      className={`read-aloud ${compact ? "compact" : ""} ${speaking ? "speaking" : ""}`}
      onClick={() => (speaking ? stopSpeak() : speak(text, lang))}
      aria-label={speaking ? t("Σταμάτα", "Stop") : t("Διάβασέ μου", "Read aloud")}
    >
      {speaking ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      <span>{speaking ? t("Σταμάτα", "Stop") : t("Διάβασέ μου", "Read aloud")}</span>
    </button>
  );
}

function swimVerdict(risk, t) {
  if (risk >= 66)
    return {
      tone: "high",
      label: t("Αυξημένη παρουσία", "High presence"),
      text: t("Προσοχή στα ρηχά και στο ψάρεμα. Μην αγγίζεις ποτέ λαγοκέφαλο — δαγκώνει δυνατά.", "Take care in shallows and when fishing. Never touch a pufferfish — it bites hard."),
    };
  if (risk >= 48)
    return {
      tone: "warn",
      label: t("Μέτρια προσοχή", "Moderate caution"),
      text: t("Το κολύμπι είναι κανονικό. Προσοχή αν ψαρεύεις ή πατάς κοντά στον βυθό.", "Swimming is fine. Take care if you fish or step near the seabed."),
    };
  if (risk >= 30)
    return {
      tone: "warn",
      label: t("Χαμηλός-μέτριος", "Low-moderate"),
      text: t("Το κολύμπι είναι κανονικό. Απλή επαγρύπνηση.", "Swimming is fine. Just stay aware."),
    };
  return {
    tone: "ok",
    label: t("Χαμηλός κίνδυνος", "Low risk"),
    text: t("Το κολύμπι είναι κανονικό στην περιοχή.", "Swimming is fine in this area."),
  };
}

function SafetyVerdict({ zone }) {
  const { t, lang } = useLang();
  if (!zone || zone.risk == null || zone.live === false) return null;
  const sv = swimVerdict(zone.risk, t);
  const SwimIcon = sv.tone === "ok" ? ShieldCheck : sv.tone === "high" ? AlertTriangle : Info;
  const eatStrong = t("ΠΟΤΕ", "NEVER");
  const eatText = t("Θανατηφόρα τοξίνη (τετροδοτοξίνη). Μην το τρως ούτε μαγειρεμένο.", "Lethal toxin (tetrodotoxin). Do not eat it, even cooked.");
  const spoken =
    lang === "en"
      ? `Swim: ${sv.label}. ${sv.text} Eat: never. ${eatText}`
      : `Κολύμπι: ${sv.label}. ${sv.text} Φαγητό: ποτέ. ${eatText}`;
  return (
    <div className="safety-verdict">
      <div className={`verdict-row swim ${sv.tone}`}>
        <SwimIcon size={20} aria-hidden="true" />
        <div>
          <strong>{t("Κολύμπι", "Swim")}: {sv.label}</strong>
          <span>{sv.text}</span>
        </div>
      </div>
      <div className="verdict-row eat danger">
        <Ban size={20} aria-hidden="true" />
        <div>
          <strong>{t("Φαγητό", "Eat")}: {eatStrong}</strong>
          <span>{eatText}</span>
        </div>
      </div>
      <ReadAloudButton text={spoken} compact />
    </div>
  );
}

function FollowStar({ active, onClick }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      className={`follow-star ${active ? "on" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t("Κατάργηση από τις παραλίες μου", "Remove from my beaches") : t("Ακολούθησε αυτή την παραλία", "Follow this beach")}
    >
      <Star size={16} fill={active ? "currentColor" : "none"} aria-hidden="true" />
      <span>{active ? t("Ακολουθείς", "Following") : t("Ακολούθησε", "Follow")}</span>
    </button>
  );
}

function MyBeaches({ zones, onSelect, onRemove }) {
  const { t, lang } = useLang();
  if (!zones.length) return null;
  const lvl = (z) =>
    lang === "en"
      ? z.risk >= 82 ? "Critical" : z.risk >= 66 ? "High" : z.risk >= 48 ? "Moderate-high" : z.risk >= 30 ? "Moderate" : "Low"
      : z.level;
  return (
    <section className="my-beaches" aria-label={t("Οι παραλίες μου", "My beaches")}>
      <span className="my-beaches-title"><Star size={15} fill="currentColor" aria-hidden="true" /> {t("Οι παραλίες μου", "My beaches")}</span>
      <div className="my-beaches-row">
        {zones.map((z) => (
          <div
            key={z.id}
            className="my-beach-chip"
            role="button"
            tabIndex={0}
            style={{ borderColor: z.color }}
            onClick={() => onSelect(z.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(z.id);
              }
            }}
            title={`${z.area} · ${lvl(z)}`}
          >
            {z.confirmed && <span className="confirmed-dot" aria-hidden="true" />}
            <span className="my-beach-name">{z.area}</span>
            <span className="my-beach-risk" style={{ background: z.color, color: riskInk(z.color) }}>{z.risk}</span>
            <span
              className="my-beach-x"
              role="button"
              tabIndex={0}
              aria-label={t("Αφαίρεση", "Remove")}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(z.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onRemove(z.id);
                }
              }}
            >
              <XCircle size={15} aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveDataBar({ status, error, lastUpdated, selectedZone, pointsCount, onRefresh }) {
  const { lang, t } = useLang();
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString(lang === "en" ? "en-GB" : "el-GR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const stateLabel =
    status === "loading"
      ? t("Σύνδεση με ζωντανές πηγές…", "Connecting to live sources…")
      : status === "error"
        ? t("Αδυναμία σύνδεσης — δεν φορτώθηκαν ζωντανά δεδομένα", "Connection failed — live data not loaded")
        : t("Ζωντανά δεδομένα ενεργά", "Live data active");
  return (
    <section className={`live-bar live-bar--${status}`} aria-label={t("Κατάσταση ζωντανών δεδομένων", "Live data status")}>
      <div className="live-bar-state">
        <span className={`live-dot live-dot--${status}`} aria-hidden="true" />
        <div>
          <strong>{stateLabel}</strong>
          <span>
            {t("Πηγές", "Sources")}: Open-Meteo Marine (SST{t("/ρεύματα", "/currents")}) · GBIF ({t("πραγματικές καταγραφές", "real records")}){" "}
            {status === "ready" && `· ${pointsCount} ${t("σημεία", "points")} · ${time}`}
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
          <span
            className="live-chip"
            title={t(
              "Επιβεβαιωμένες επιστημονικές καταγραφές του λαγοκέφαλου κοντά σε αυτή την περιοχή τα τελευταία 3 χρόνια (πηγή: GBIF).",
              "Confirmed scientific records of the pufferfish near this area in the last 3 years (source: GBIF)."
            )}
          >
            <Fish size={14} aria-hidden="true" /> {selectedZone.occRecent} {t("καταγραφές/3ετία", "records/3y")}
          </span>
        )}
        <button type="button" className="live-refresh" onClick={onRefresh} disabled={status === "loading"}>
          <Radar size={15} aria-hidden="true" /> {t("Ανανέωση", "Refresh")}
        </button>
      </div>
      {error && <p className="live-bar-error">{error}</p>}
    </section>
  );
}

function IntelligenceStrip({ forecast, selectedZone }) {
  const { lang, t } = useLang();
  const notLive = selectedZone?.live === false;
  return (
    <section className="intelligence-strip" aria-label={t("AI επιχειρησιακή πρόβλεψη", "AI operational forecast")}>
      <article>
        <Radar size={20} aria-hidden="true" />
        <span>{t("Τρέχων κίνδυνος", "Current risk")}</span>
        <strong>{notLive ? "—" : `${selectedZone.risk}/100`}</strong>
      </article>
      {forecast.map((item) => (
        <article key={item.label}>
          <Clock3 size={20} aria-hidden="true" />
          <span>{item.label}</span>
          <strong>{notLive ? "—" : `${item.score}/100`}</strong>
        </article>
      ))}
      <article>
        <BrainCircuit size={20} aria-hidden="true" />
        <span>{t("Κάλυψη δεδομένων", "Data coverage")}</span>
        <strong>{notLive ? "—" : `${forecast.confidence}%`}</strong>
      </article>
      <article className="decision">
        <Siren size={20} aria-hidden="true" />
        <span>{t("Σύσταση AI", "AI recommendation")}</span>
        <strong>{lang === "en" && forecast.recommendationEn ? forecast.recommendationEn : forecast.recommendation}</strong>
      </article>
    </section>
  );
}

// Δορυφόροι ως overlay πάνω από τον Leaflet χάρτη (pointer-events:none → ο χάρτης
// μένει διαδραστικός). Ίδια αισθητική με την υδρόγειο: 3 σε τροχιά + 1 πάνω από τη
// θάλασσα με δέσμη σάρωσης. Σέβεται prefers-reduced-motion.
function MapSatGlyph({ x, y, sc, op, tilt, color }) {
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${sc.toFixed(3)}) rotate(${tilt.toFixed(1)})`} opacity={op.toFixed(2)} style={{ color }}>
      <circle r="9" className="gg-sat-glow" />
      <line x1="-11" y1="0" x2="11" y2="0" className="gg-sat-axis" />
      <rect x="-12" y="-4" width="7" height="8" rx="1" className="gg-sat-panel" />
      <rect x="5" y="-4" width="7" height="8" rx="1" className="gg-sat-panel" />
      <rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx="1.6" className="gg-sat-body" />
      <circle cx="0" cy="-6" r="1.2" className="gg-sat-dish" />
    </g>
  );
}

function MapSatelliteOverlay() {
  const [tSec, setTSec] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const loop = (t) => {
      setTSec(t / 1000);
      raf = window.requestAnimationFrame(loop);
    };
    const apply = () => {
      window.cancelAnimationFrame(raf);
      if (!mq?.matches) raf = window.requestAnimationFrame(loop);
    };
    apply();
    mq?.addEventListener?.("change", apply);
    return () => {
      window.cancelAnimationFrame(raf);
      mq?.removeEventListener?.("change", apply);
    };
  }, []);

  const W = 600;
  const H = 400;
  const orbit = { cx: 300, cy: 116, rx: 232, ry: 66 };
  const sats = [
    { color: "#79efff", phase: 0.0 },
    { color: "#ffd36a", phase: 0.4 },
    { color: "#b8ffe8", phase: 0.72 },
  ];
  const sea = { cx: 432, cy: 196, rx: 58, ry: 19, period: 28 };
  const sa = (tSec / sea.period) * Math.PI * 2;
  const sx = sea.cx + sea.rx * Math.cos(sa);
  const sy = sea.cy + sea.ry * Math.sin(sa);
  const sDepth = (Math.sin(sa) + 1) / 2;
  const sSc = 0.8 + sDepth * 0.5;
  const beamOp = 0.1 + 0.07 * (Math.sin(tSec * 1.3) + 1) / 2;

  return (
    <svg className="map-sat-overlay" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="map-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fe9ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7fe9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx={orbit.cx} cy={orbit.cy} rx={orbit.rx} ry={orbit.ry} className="gg-sat-orbit" />
      {sats.map((s, i) => {
        const a = (tSec / 38 + s.phase) * Math.PI * 2;
        const x = orbit.cx + orbit.rx * Math.cos(a);
        const y = orbit.cy + orbit.ry * Math.sin(a);
        const depth = (Math.sin(a) + 1) / 2;
        return <MapSatGlyph key={i} x={x} y={y} sc={0.75 + depth * 0.5} op={0.4 + depth * 0.55} tilt={Math.cos(a) * 16} color={s.color} />;
      })}
      <g style={{ color: "#7fe9ff" }}>
        <path
          d={`M ${(sx - 2).toFixed(2)} ${(sy + 3).toFixed(2)} L ${(sx + 2).toFixed(2)} ${(sy + 3).toFixed(2)} L ${(sx + 12).toFixed(2)} ${(sy + 44).toFixed(2)} L ${(sx - 12).toFixed(2)} ${(sy + 44).toFixed(2)} Z`}
          fill="url(#map-beam)"
          opacity={beamOp.toFixed(2)}
        />
        <ellipse cx={sx.toFixed(2)} cy={(sy + 44).toFixed(2)} rx="11" ry="3" fill="#7fe9ff" opacity={(beamOp * 1.4).toFixed(2)} className="gg-sat-scanpad" />
        <MapSatGlyph x={sx} y={sy} sc={sSc} op={0.95} tilt={0} color="#7fe9ff" />
      </g>
    </svg>
  );
}

function BrandLogo3D() {
  const mountRef = useRef(null);
  const { t } = useLang();

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
    <div className="brand-logo-3d" ref={mountRef} aria-label={t("Τρισδιάστατο λογότυπο EV SEA GUARD AI", "EV SEA GUARD AI 3D logo")}>
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
  onSafety,
  follows,
  onToggleFollow
}) {
  const { t, lang } = useLang();
  const peakForecast = Math.max(...forecast.map((item) => item.score));
  const lvl = (z) => {
    if (!z.live) return lang === "el" ? "Δεν φορτώθηκε" : "Not loaded";
    if (lang === "el") return z.level;
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
            placeholder={t("π.χ. Ρόδος, Κως, Ηράκλειο, Χαλκιδική", "e.g. Rhodes, Kos, Heraklion, Halkidiki")}
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
          .filter((zone) => zone.id !== "__search" && (zone.popular || zone.id === selectedZone.id))
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
          <span>{selectedZone.live === false ? "—" : selectedZone.risk}</span>
          <small>/100</small>
        </div>
        <div className="result-details">
          <p className="eyebrow">{t("Αποτέλεσμα περιοχής", "Area result")}</p>
          <h3>
            {selectedZone.area}
            {selectedZone.confirmed && (
              <span className="confirmed-badge" title={t("Επιβεβαιωμένη παρουσία λαγοκέφαλου", "Confirmed pufferfish presence")}>
                <span className="confirmed-dot" aria-hidden="true" /> {t("Επιβεβαιωμένη παρουσία", "Confirmed presence")}
              </span>
            )}
          </h3>
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
          <SafetyVerdict zone={selectedZone} />
          <p>{lang === "en" && selectedZone.recommendationEn ? selectedZone.recommendationEn : selectedZone.recommendation}</p>
        </div>
        <div className="result-actions">
          <button type="button" className="primary-action" onClick={onReport}>
            <Camera size={18} aria-hidden="true" />
            {t("Κάνε αναφορά", "Report")}
          </button>
          {selectedZone.id !== "__search" && onToggleFollow && (
            <FollowStar active={(follows || []).includes(selectedZone.id)} onClick={() => onToggleFollow(selectedZone.id)} />
          )}
          <ShareButton zone={selectedZone} />
          <QrButton zone={selectedZone} />
        </div>
      </div>
    </section>
  );
}

function SeaGuard3D({ selectedZone, forecast, zones, onSelectZone }) {
  const { t } = useLang();
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
    <section className="mission-theater" aria-label="3D Satellite AI Layer">
      <div className="theater-copy">
        <p className="eyebrow">{t("Ζωντανό AI · Δορυφορικά δεδομένα", "Live AI · Satellite data")}</p>
        <h2>{t("Δες αν κολυμπάς με ασφάλεια — ζωντανά, για κάθε ελληνική παραλία.", "Know if it's safe to swim — live, for every Greek beach.")}</h2>
        <p>
          {t(
            "Η εφαρμογή που ενώνει πραγματική θερμοκρασία θάλασσας, επιστημονικές καταγραφές και AI για να σε προειδοποιεί για τον δηλητηριώδη λαγοκέφαλο — σε όλη την Ελλάδα.",
            "The app that combines real sea temperature, scientific records and AI to warn you about the poisonous pufferfish — across all of Greece."
          )}
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
  const { t } = useLang();
  return (
    <div className="legend" aria-label={t("Υπόμνημα κινδύνου", "Risk legend")}>
      <span><i style={{ background: "#2fa66a" }} />{t("Χαμηλός", "Low")}</span>
      <span><i style={{ background: "#e6c84f" }} />{t("Μέτριος", "Moderate")}</span>
      <span><i style={{ background: "#f08c2e" }} />{t("Μέτριος προς υψηλός", "Moderate-high")}</span>
      <span><i style={{ background: "#e73d3d" }} />{t("Υψηλός", "High")}</span>
      <span><i style={{ background: "#c0202a" }} />{t("Κρίσιμος", "Critical")}</span>
    </div>
  );
}

function InstallGuide() {
  const { t } = useLang();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    try {
      if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    } catch {}
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const doInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
  };
  return (
    <article className="info-panel wide install-guide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("Εγκατάσταση στο κινητό", "Install on mobile")}</p>
          <h2>{t("Κατέβασέ το σαν εφαρμογή — δωρεάν", "Get it as an app — free")}</h2>
        </div>
        <Download size={24} aria-hidden="true" />
      </div>
      {installed ? (
        <p className="install-ok">✓ {t("Η εφαρμογή είναι ήδη εγκατεστημένη στη συσκευή σου!", "The app is already installed on your device!")}</p>
      ) : (
        <>
          {deferred && (
            <button type="button" className="primary-action install-now" onClick={doInstall}>
              <Download size={18} aria-hidden="true" /> {t("Εγκατάσταση τώρα", "Install now")}
            </button>
          )}
          <div className="install-cols">
            <div>
              <h4>Android (Chrome)</h4>
              <ol>
                <li>{t("Άνοιξε αυτό το link στον Chrome.", "Open this link in Chrome.")}</li>
                <li>{t("Πάτα το μενού ⋮ (πάνω δεξιά).", "Tap the ⋮ menu (top right).")}</li>
                <li>{t("Διάλεξε «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».", "Choose “Install app” or “Add to Home screen”.")}</li>
              </ol>
            </div>
            <div>
              <h4>iPhone / iPad (Safari)</h4>
              <ol>
                <li>{t("Άνοιξε αυτό το link στο Safari.", "Open this link in Safari.")}</li>
                <li>{t("Πάτα το κουμπί Κοινή χρήση (□↑).", "Tap the Share button (□↑).")}</li>
                <li>{t("Διάλεξε «Προσθήκη στην Αρχική οθόνη».", "Choose “Add to Home Screen”.")}</li>
              </ol>
            </div>
          </div>
          <p className="install-note">{t("Θα εμφανιστεί εικονίδιο στην αρχική οθόνη και θα ανοίγει σαν κανονική εφαρμογή — και χωρίς ίντερνετ.", "An icon appears on your home screen and opens like a real app — even offline.")}</p>
        </>
      )}
    </article>
  );
}

const STRIPE_SUPPORT_URL = "https://buy.stripe.com/eVqdRb0v1aP96YVarj1gs09";

function SupportCard() {
  const { t } = useLang();
  return (
    <article className="info-panel wide support-card">
      <div className="support-inner">
        <div className="support-copy">
          <p className="eyebrow">{t("Στήριξε την εφαρμογή", "Support this app")}</p>
          <h3>{t("Κράτα το EV SEA GUARD AI ζωντανό & δωρεάν", "Keep EV SEA GUARD AI alive & free")}</h3>
          <p>{t(
            "Η εφαρμογή είναι δωρεάν για όλους. Με μια μικρή στήριξη €0,99 βοηθάς να συνεχίσει, να μένει ενημερωμένη και να βελτιώνεται.",
            "The app is free for everyone. A small €0.99 contribution helps it keep running, stay updated and improve."
          )}</p>
        </div>
        <a className="support-btn" href={STRIPE_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
          <Star size={18} aria-hidden="true" fill="currentColor" />
          {t("Στήριξε με €0,99", "Support with €0.99")}
        </a>
      </div>
    </article>
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
      <InstallGuide />
      <SupportCard />
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
            "An invasive Lessepsian species that has spread across the Greek seas. It bites through nets, long-lines and fish, and is dangerously poisonous to humans because of its tetrodotoxin. The app combines real sea-surface temperature (SST), real species records (GBIF) and citizen/fisherman reports to show areas of higher likelihood of presence."
          )}
        </p>
      </article>
      <article className="info-panel wide recognition-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Αναγνώριση", "Identification")}</p>
            <h3>{t("Πώς να αναγνωρίσεις τον λαγοκέφαλο", "How to recognize the pufferfish")}</h3>
          </div>
          <Fish size={24} aria-hidden="true" />
        </div>
        <div className="recognition-body">
          <svg className="recognition-fish" viewBox="0 0 200 120" aria-hidden="true">
            <ellipse cx="95" cy="60" rx="62" ry="38" fill="#cfe0a8" stroke="#7a8a52" strokeWidth="2.5" />
            <path d="M157 60 L192 34 L186 60 L192 86 Z" fill="#cfe0a8" stroke="#7a8a52" strokeWidth="2.5" />
            <circle cx="62" cy="48" r="7" fill="#1b2b1b" />
            <circle cx="60" cy="46" r="2.4" fill="#fff" />
            <path d="M33 62 q-9 -7 -2 -14 M33 62 q-9 7 -2 14" fill="none" stroke="#1b2b1b" strokeWidth="3" strokeLinecap="round" />
            {[78, 100, 122, 78, 100, 122].map((cx, i) => (
              <circle key={i} cx={cx} cy={i < 3 ? 44 : 72} r="4.5" fill="#7a8a52" opacity="0.75" />
            ))}
            <g stroke="#9aa86a" strokeWidth="2.2" strokeLinecap="round">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
                const a = (n / 8) * Math.PI * 2;
                return <line key={n} x1={95 + Math.cos(a) * 40} y1={60 + Math.sin(a) * 26} x2={95 + Math.cos(a) * 52} y2={60 + Math.sin(a) * 34} />;
              })}
            </g>
          </svg>
          <ul className="recognition-list">
            <li><b>{t("Ασημί-γκρι σώμα", "Silver-grey body")}</b> · {t("λευκή κοιλιά", "white belly")}</li>
            <li><b>{t("Μεγάλα δόντια σαν ράμφος", "Large beak-like teeth")}</b> {t("(4 δόντια)", "(4 teeth)")}</li>
            <li>{t("Φουσκώνει σαν μπάλα όταν απειλείται", "Inflates like a ball when threatened")}</li>
            <li>{t("Σκούρες κηλίδες στην πλάτη", "Dark spots on the back")}</li>
            <li>{t("Μήκος έως 1 μέτρο", "Up to 1 metre long")}</li>
          </ul>
        </div>
        <p className="recognition-warn">
          <AlertTriangle size={16} aria-hidden="true" />
          {t(
            "Αν δεις ψάρι με αυτά τα χαρακτηριστικά: ΜΗΝ το αγγίξεις, ΜΗΝ το φας — φωτογράφισε από απόσταση & ανέφερέ το.",
            "If you see a fish with these traits: DON'T touch it, DON'T eat it — photograph from a distance & report it.",
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
  const { t, lang } = useLang();
  const notLive = selectedZone?.live === false;
  const bd = selectedZone.breakdown;
  const breakdownRows = bd
    ? [
        {
          label: t("Καταλληλότητα θερμοκρασίας (SST)", "Temperature suitability (SST)"),
          value: bd.sst,
          detail:
            selectedZone.sst != null
              ? t(`${selectedZone.sst.toFixed(1)}°C · βαρύτητα 45%`, `${selectedZone.sst.toFixed(1)}°C · weight 45%`)
              : t("βαρύτητα 45%", "weight 45%"),
        },
        {
          label: t("Πραγματική παρουσία (GBIF)", "Real presence (GBIF)"),
          value: bd.occurrence,
          detail: t(`${selectedZone.occRecent ?? 0} καταγραφές/3ετία · βαρύτητα 35%`, `${selectedZone.occRecent ?? 0} records/3y · weight 35%`),
        },
        {
          label: t("Σήμα κοινότητας", "Community signal"),
          value: bd.community,
          detail: t("αναφορές + κιλά αλιέων · βαρύτητα 20%", "reports + fishermen kg · weight 20%"),
        },
      ]
    : null;

  return (
    <section className="panel-grid">
      <article className="info-panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Μηχανή κινδύνου λαγοκέφαλου · ζωντανός υπολογισμός", "Pufferfish Risk Engine · live calculation")}</p>
            <h2>{notLive
              ? t(`${selectedZone.area} — δεν φορτώθηκε`, `${selectedZone.area} — not loaded`)
              : t(`Δείκτης κινδύνου ${selectedZone.risk}/100 για ${selectedZone.area}`, `Risk score ${selectedZone.risk}/100 for ${selectedZone.area}`)}</h2>
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
              {t(
                "Τύπος: Risk = 45%·SST + 35%·Παρουσία + 20%·Κοινότητα (διαφανές, χωρίς «μαύρο κουτί»).",
                "Formula: Risk = 45%·SST + 35%·Presence + 20%·Community (transparent, no black box)."
              )}
            </p>
          </>
        ) : (
          <p>{t("Φόρτωση ζωντανών δεδομένων για τον υπολογισμό κινδύνου…", "Loading live data for the risk calculation…")}</p>
        )}
      </article>
      <article className="info-panel">
        <h3>{t("Σύσταση περιοχής", "Area recommendation")}</h3>
        <p>{lang === "en" && selectedZone.recommendationEn ? selectedZone.recommendationEn : selectedZone.recommendation}</p>
        <div className="notice-line">
          <Megaphone size={18} aria-hidden="true" />
          {selectedZone.risk >= 80
            ? t("Προτείνεται ανακοίνωση φορέα.", "An authority announcement is recommended.")
            : t("Συνέχιση παρακολούθησης.", "Continue monitoring.")}
        </div>
      </article>
      <ForecastPanel forecast={forecast} />
      <SatelliteFeedsPanel />
      <AiModelStackPanel />
    </section>
  );
}

function ForecastPanel({ forecast }) {
  const { t, lang } = useLang();
  return (
    <article className="info-panel wide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("Predictive forecast", "Predictive forecast")}</p>
          <h3>{t("Πρόβλεψη κινδύνου 24/48/72h", "24/48/72h risk forecast")}</h3>
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
            <small>{lang === "en" && item.reasonEn ? item.reasonEn : item.reason}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function SatelliteFeedsPanel() {
  const { t, lang } = useLang();
  return (
    <article className="info-panel wide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("Satellite data fusion", "Satellite data fusion")}</p>
          <h3>{t("Ζωντανές πηγές δεδομένων", "Live data sources")}</h3>
        </div>
        <Satellite size={22} aria-hidden="true" />
      </div>
      <div className="feed-grid">
        {satelliteFeeds.map((feed) => (
          <div className={`feed-card feed-card--${feed.status}`} key={feed.id}>
            <div>
              <strong>{lang === "en" ? feed.nameEn : feed.name}</strong>
              <span>{lang === "en" ? feed.detailEn : feed.detail}</span>
            </div>
            <div className="feed-meter">
              <i style={{ width: `${feed.signal}%` }} />
            </div>
            <small>
              <span className={`feed-badge feed-badge--${feed.status}`}>
                {feed.status === "live" ? t("ΖΩΝΤΑΝΟ", "LIVE") : t("ΕΠΟΜΕΝΗ ΦΑΣΗ", "NEXT PHASE")}
              </span>{" "}
              {lang === "en" ? feed.cadenceEn : feed.cadence}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}

function AiModelStackPanel() {
  const { t, lang } = useLang();
  return (
    <article className="info-panel wide">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("Αρχιτεκτονική AI · χάρτης ανάπτυξης", "AI architecture · roadmap")}</p>
          <h3>{t("Μοντέλα υπό ανάπτυξη", "Models in development")}</h3>
        </div>
        <BrainCircuit size={22} aria-hidden="true" />
      </div>
      <p className="model-note">
        {t(
          "Ο ζωντανός υπολογισμός σήμερα γίνεται με τον διαφανή τύπο 45/35/20 (δες «Πηγές & Μεθοδολογία»). Τα παρακάτω είναι ο σχεδιασμός επόμενης φάσης.",
          "Today's live calculation uses the transparent 45/35/20 formula (see “Sources & Methodology”). The below is the next-phase roadmap."
        )}
      </p>
      <div className="model-stack">
        {aiModels.map((model) => (
          <div className="model-row" key={model.name}>
            <div>
              <strong>{model.name}</strong>
              <span>{lang === "en" ? model.purposeEn : model.purpose}</span>
            </div>
            <span className="model-planned">{t("σχεδιασμός", "roadmap")}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function CitizenReportPanel({ onSubmit, selectedZone, locateUser }) {
  const { t } = useLang();
  return (
    <section className="panel-grid">
      <form className="info-panel wide form-panel" onSubmit={onSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Πολίτης / λουόμενος", "Citizen / swimmer")}</p>
            <h2>{t("Αναφορά λαγοκέφαλου", "Report a pufferfish")}</h2>
          </div>
          <Camera size={24} aria-hidden="true" />
        </div>
        <div className="form-grid">
          <label>
            {t("Φωτογραφία", "Photo")}
            <input name="photo" type="file" accept="image/*" />
          </label>
          <label>
            {t("Περιοχή / παραλία", "Area / beach")}
            <input name="area" type="text" placeholder={selectedZone.area} />
          </label>
          <label>
            {t("Το είδα", "I saw it")}
            <select name="place" defaultValue="στη θάλασσα">
              <option value="στη θάλασσα">{t("στη θάλασσα", "in the sea")}</option>
              <option value="έξω στην ακτή">{t("έξω στην ακτή", "out on the shore")}</option>
              <option value="σε αλιευτικά εργαλεία">{t("σε αλιευτικά εργαλεία", "in fishing gear")}</option>
            </select>
          </label>
          <label>
            {t("Κατάσταση", "Condition")}
            <select name="condition" defaultValue="ζωντανό">
              <option value="ζωντανό">{t("ζωντανό", "alive")}</option>
              <option value="νεκρό">{t("νεκρό", "dead")}</option>
              <option value="άγνωστο">{t("άγνωστο", "unknown")}</option>
            </select>
          </label>
          <label>
            {t("Υπήρξε δάγκωμα;", "Was there a bite?")}
            <select name="bite" defaultValue="Όχι">
              <option value="Όχι">{t("Όχι", "No")}</option>
              <option value="Ναι">{t("Ναι", "Yes")}</option>
            </select>
          </label>
          <label className="full">
            {t("Σχόλιο", "Comment")}
            <textarea name="comment" rows="4" placeholder={t("Σύντομη περιγραφή περιστατικού", "Short description of the incident")} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-action" onClick={locateUser}>
            <LocateFixed size={18} aria-hidden="true" />
            {t("Αυτόματο GPS", "Auto GPS")}
          </button>
          <button type="submit" className="primary-action">
            <Upload size={18} aria-hidden="true" />
            {t("Αποστολή", "Send")}
          </button>
        </div>
      </form>
      <article className="info-panel">
        <h3>{t("Μετά την αποστολή", "After you send")}</h3>
        <p>
          {t(
            "Η αναφορά καταχωρείται ως pending, περνά από demo AI αναγνώριση φωτογραφίας και μετά εμφανίζεται στο admin panel για έγκριση ή απόρριψη.",
            "The report is logged as pending, goes through demo AI photo recognition and then appears in the admin panel for approval or rejection."
          )}
        </p>
      </article>
    </section>
  );
}

function AiResultPanel({ report }) {
  const { t } = useLang();
  if (!report) return null;
  return (
    <section className="panel-grid">
      <article className="info-panel wide ai-result">
        <div>
          <p className="eyebrow">{t("AI αναγνώριση φωτογραφίας · ενδεικτικό demo", "AI photo recognition · indicative demo")}</p>
          <h2>{t("Πιθανός λαγοκέφαλος", "Likely pufferfish")}</h2>
          <strong>{report.ai}% <span className="ai-demo-tag">{t("ενδεικτικά", "indicative")}</span></strong>
          <p>{t("Ενδεικτική εκτίμηση επίδειξης — η τελική επιβεβαίωση γίνεται από ειδικό μετά τον έλεγχο.", "Indicative demo estimate — final confirmation is made by an expert after review.")}</p>
          <p>{t("Κατάσταση: στάλθηκε για έλεγχο.", "Status: sent for review.")}</p>
          <p>{t("Οδηγία: Μην το αγγίζεις, μην το μετακινείς και μην το καταναλώσεις.", "Guidance: Do not touch it, do not move it and do not eat it.")}</p>
        </div>
        <Fish size={72} aria-hidden="true" />
      </article>
    </section>
  );
}

function FishermanPanel({ catches, onSubmit }) {
  const { t, lang } = useLang();
  const totalKg = catches.reduce((sum, item) => sum + Number(item.kg || 0), 0);
  const estimatedCompensation = totalKg * 5.33;

  return (
    <section className="panel-grid">
      <form className="info-panel wide form-panel" onSubmit={onSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Panel ψαρά", "Fisherman panel")}</p>
            <h2>{t("Νέα δήλωση αλίευσης", "New catch declaration")}</h2>
          </div>
          <Anchor size={24} aria-hidden="true" />
        </div>
        <div className="form-grid">
          <label>
            {t("Όνομα σκάφους", "Vessel name")}
            <input name="vessel" type="text" placeholder={t("π.χ. ΑΓ. ΝΙΚΟΛΑΟΣ", "e.g. AG. NIKOLAOS")} />
          </label>
          <label>
            {t("Λιμάνι", "Port")}
            <input name="port" type="text" placeholder={t("π.χ. Ηράκλειο", "e.g. Heraklion")} />
          </label>
          <label>
            {t("GPS αλίευσης", "Catch GPS")}
            <input name="gps" type="text" placeholder="35.12, 25.20" />
          </label>
          <label>
            {t("Κιλά λαγοκέφαλου", "Pufferfish kg")}
            <input name="kg" type="number" min="0" step="0.1" placeholder="0" />
          </label>
          <label>
            {t("Περιοχή", "Area")}
            <input name="area" type="text" placeholder={t("Περιοχή αλίευσης", "Catch area")} />
          </label>
          <label>
            {t("Φωτογραφίες", "Photos")}
            <input name="photos" type="file" accept="image/*" multiple />
          </label>
          <label className="full">
            {t("Ζημιές σε δίχτυα / παραγάδια", "Damage to nets / long-lines")}
            <textarea name="damage" rows="3" placeholder={t("Περιγραφή ζημιάς", "Damage description")} />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-action">
            <ClipboardCheck size={18} aria-hidden="true" />
            {t("Υποβολή δήλωσης", "Submit declaration")}
          </button>
        </div>
      </form>
      <article className="info-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Pilot action calculator", "Pilot action calculator")}</p>
            <h3>{t("Εκτίμηση διαχείρισης κιλών", "Kg management estimate")}</h3>
          </div>
          <Fish size={22} aria-hidden="true" />
        </div>
        <div className="compensation-box">
          <span>{t("Σύνολο δηλωμένων κιλών", "Total declared kg")}</span>
          <strong>{totalKg} kg</strong>
          <span>{t("Demo καθαρή αμοιβή 5,33€/kg", "Demo net rate €5.33/kg")}</span>
          <strong>{estimatedCompensation.toLocaleString(lang === "en" ? "en-GB" : "el-GR", { style: "currency", currency: "EUR" })}</strong>
        </div>
        <p>
          {t(
            "Η παραγωγική έκδοση θα συνδέει δήλωση, σημείο παράδοσης, έγκριση φορέα, ψύξη, καύση και ιστορικό πληρωμών.",
            "The production version will link declaration, delivery point, authority approval, cold storage, incineration and payment history."
          )}
        </p>
      </article>
      <DataTable title={t("Τελευταίες δηλώσεις αλιέων", "Latest fishermen declarations")} rows={catches} type="catch" />
    </section>
  );
}

const MONITOR_REGIONS = [
  "Δωδεκάνησα", "Κυκλάδες", "Κρήτη", "Β. Αιγαίο", "Σποράδες",
  "Ιόνιο", "Χαλκιδική", "Θράκη", "Εύβοια", "Αττική", "Πελοπόννησος",
];
const REGION_EN = {
  "Δωδεκάνησα": "Dodecanese", "Κυκλάδες": "Cyclades", "Κρήτη": "Crete",
  "Β. Αιγαίο": "N. Aegean", "Σποράδες": "Sporades", "Ιόνιο": "Ionian",
  "Χαλκιδική": "Halkidiki", "Θράκη": "Thrace", "Εύβοια": "Euboea",
  "Αττική": "Attica", "Πελοπόννησος": "Peloponnese",
};
const regionLabel = (r, lang) => (lang === "en" ? REGION_EN[r] || r : r);

function monitorLevel(risk, lang) {
  if (risk >= 82) return lang === "en" ? "CRITICAL" : "ΚΡΙΣΙΜΟΣ";
  if (risk >= 66) return lang === "en" ? "HIGH" : "ΥΨΗΛΟΣ";
  if (risk >= 48) return lang === "en" ? "MODERATE-HIGH" : "ΜΕΤΡΙΟΣ-ΥΨΗΛΟΣ";
  if (risk >= 30) return lang === "en" ? "MODERATE" : "ΜΕΤΡΙΟΣ";
  return lang === "en" ? "LOW" : "ΧΑΜΗΛΟΣ";
}

// Ειδική εγκατάσταση για δημόσιες υπηρεσίες: full-screen κέντρο επιχειρήσεων,
// στοχευμένη ανίχνευση λαγοκέφαλου στην περιοχή ευθύνης του φορέα.
function AuthorityMonitor({ zones, realPoints, sightings, onExit, onRefresh }) {
  const { lang, t } = useLang();
  const [region, setRegion] = useState(() => {
    try {
      return localStorage.getItem("sg-monitor-region") || "Δωδεκάνησα";
    } catch {
      return "Δωδεκάνησα";
    }
  });
  const [now, setNow] = useState(() => new Date());
  const rootRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("sg-monitor-region", region);
    } catch {}
  }, [region]);
  // αυτόματη ανανέωση δεδομένων κάθε 10 λεπτά
  useEffect(() => {
    if (!onRefresh) return undefined;
    const id = setInterval(() => onRefresh(), 600000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const regionZones = useMemo(
    () => zones.filter((z) => z.region === region).sort((a, b) => b.risk - a.risk),
    [zones, region]
  );
  const liveRegionZones = regionZones.filter((z) => z.live);
  const top = liveRegionZones[0] || regionZones[0];
  const highCount = liveRegionZones.filter((z) => z.risk >= 66).length;
  const totalRecords = liveRegionZones.reduce((s, z) => s + (z.occRecent || 0), 0);
  const regionReports = sightings.filter((s) =>
    regionZones.some((z) => (s.area || "").includes(z.area.split(/[ /]/)[0]))
  );
  const statusColor = top ? top.color : "#5fb37a";

  const toggleFs = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  const clock = now.toLocaleTimeString(lang === "en" ? "en-GB" : "el-GR");
  const day = now.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="ops-monitor" ref={rootRef}>
      <header className="ops-head">
        <div className="ops-brand">
          <Radar size={22} aria-hidden="true" />
          <div>
            <strong>EV SEA GUARD AI</strong>
            <span>{t("ΚΕΝΤΡΟ ΕΠΙΧΕΙΡΗΣΕΩΝ · στοχευμένη ανίχνευση", "OPERATIONS CENTER · targeted detection")}</span>
          </div>
        </div>
        <label className="ops-region">
          <span>{t("Περιοχή ευθύνης", "Area of responsibility")}</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {MONITOR_REGIONS.map((r) => (
              <option key={r} value={r}>{regionLabel(r, lang)}</option>
            ))}
          </select>
        </label>
        <div className="ops-clock">
          <strong>{clock}</strong>
          <span>{day} · <i className="ops-live">{t("ΖΩΝΤΑΝΑ", "LIVE")}</i></span>
        </div>
        <div className="ops-head-btns">
          <button type="button" onClick={toggleFs} aria-label={t("Πλήρης οθόνη", "Fullscreen")}><Layers size={18} /></button>
          <button type="button" onClick={onExit} aria-label={t("Έξοδος", "Exit")}><XCircle size={20} /></button>
        </div>
      </header>

      <div className="ops-body">
        <section className="ops-status" style={{ borderColor: statusColor }}>
          <p className="ops-status-eyebrow">{t("ΚΑΤΑΣΤΑΣΗ ΠΕΡΙΟΧΗΣ", "AREA STATUS")} — {regionLabel(region, lang)}</p>
          {top && top.live !== false ? (
            <>
              <div className="ops-status-main">
                <span className="ops-status-level" style={{ color: statusColor }}>{monitorLevel(top.risk, lang)}</span>
                <span className="ops-status-score">{top.risk}<small>/100</small></span>
              </div>
              <p className="ops-status-zone">{t("Υψηλότερος κίνδυνος", "Highest risk")}: <strong>{top.area}</strong></p>
              <div className="ops-status-kpis">
                <div><b>{highCount}</b><span>{t("ζώνες υψηλού κινδύνου", "high-risk zones")}</span></div>
                <div><b>{totalRecords}</b><span>{t("καταγραφές GBIF (3ετία)", "GBIF records (3y)")}</span></div>
                <div><b>{regionReports.length}</b><span>{t("αναφορές πολιτών", "citizen reports")}</span></div>
                <div><b>{regionZones.length}</b><span>{t("ζώνες παρακολούθησης", "monitored zones")}</span></div>
              </div>
            </>
          ) : (
            <p className="ops-status-zone">{t("Φόρτωση δεδομένων περιοχής…", "Loading area data…")}</p>
          )}
        </section>

        <section className="ops-zones">
          <h3>{t("Ζώνες περιοχής", "Area zones")}</h3>
          <div className="ops-zone-grid">
            {regionZones.map((z) => {
              const nl = z.live === false;
              return (
              <div key={z.id} className="ops-zone-card" style={{ borderColor: z.color }}>
                <div className="ops-zone-top">
                  <span className="ops-zone-name">{z.area}</span>
                  <span className="ops-zone-risk" style={{ background: z.color, color: riskInk(z.color) }}>{nl ? "—" : z.risk}</span>
                </div>
                <div className="ops-zone-facts">
                  <span>{z.sst != null ? `${z.sst.toFixed(1)}°C` : "—"}</span>
                  <span>{nl ? t("Δεν φορτώθηκε", "Not loaded") : monitorLevel(z.risk, lang)}</span>
                  <span>{z.occRecent || 0} {t("καταγρ.", "rec.")}</span>
                </div>
              </div>
              );
            })}
          </div>
        </section>

        <aside className="ops-alerts">
          <h3><Siren size={18} aria-hidden="true" /> {t("Στοχευμένη ανίχνευση", "Targeted detection")}</h3>
          {regionZones.filter((z) => z.live && z.risk >= 66).length === 0 && (
            <p className="ops-alert-none">{t("Καμία ζώνη υψηλού κινδύνου αυτή τη στιγμή.", "No high-risk zone at this time.")}</p>
          )}
          {regionZones
            .filter((z) => z.live && z.risk >= 66)
            .map((z) => (
              <div key={z.id} className="ops-alert-row" style={{ borderColor: z.color }}>
                <AlertTriangle size={16} style={{ color: z.color }} aria-hidden="true" />
                <div>
                  <strong>{z.area}</strong>
                  <span>{monitorLevel(z.risk, lang)} · {z.risk}/100 · {z.occRecent || 0} {t("καταγραφές", "records")}</span>
                </div>
              </div>
            ))}
          <div className="ops-foot-sources">
            {t("Πηγές", "Sources")}: Open-Meteo Marine · GBIF · {t("ανανέωση κάθε 10′", "refresh every 10′")}
          </div>
        </aside>
      </div>
      <footer className="ops-footer">
        <span>{t("Ενημερωτικό εργαλείο — όχι επίσημη ειδοποίηση. Έκτακτη ανάγκη: 112 · Λιμενικό 108.", "Informational tool — not an official alert. Emergency: 112 · Coast Guard 108.")}</span>
        <span>EV LABS AI · evlabsai.gr</span>
      </footer>
    </div>
  );
}

function AuthorityPanel({ sightings, catches, selectedZone, forecast, authorityAction, exportCsv, exportPdf, onOpenMonitor }) {
  const { t } = useLang();
  return (
    <section className="panel-grid">
      <article className="info-panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("Dashboard φορέα", "Authority dashboard")}</p>
            <h2>{t(`Περιοχή ελέγχου: ${selectedZone.area}`, `Monitored area: ${selectedZone.area}`)}</h2>
          </div>
          <div className="export-actions">
            <button type="button" className="primary-action" onClick={onOpenMonitor}>
              <Radar size={18} aria-hidden="true" />
              {t("Κέντρο Επιχειρήσεων", "Operations Monitor")}
            </button>
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
        <p className="authority-monitor-hint">
          {t(
            "Ειδική εγκατάσταση για δημόσιες υπηρεσίες: άνοιξε σε μόνιτορ/τηλεόραση πλήρους οθόνης για ζωντανή, στοχευμένη ανίχνευση λαγοκέφαλου στην περιοχή ευθύνης σου.",
            "Public-service installation: open on a full-screen monitor/TV for live, targeted pufferfish detection across your area of responsibility."
          )}
        </p>
        <div className="authority-grid">
          <Metric icon={Bell} label={t("Σύνολο αναφορών", "Total reports")} value={sightings.length} />
          <Metric icon={BadgeCheck} label={t("Επιβεβαιωμένες", "Confirmed")} value={sightings.filter((item) => item.status === "verified").length} />
          <Metric icon={Fish} label={t("Δηλώσεις ψαράδων", "Fishermen declarations")} value={catches.length} />
          <Metric icon={AlertTriangle} label={t("Περιστατικά δαγκώματος", "Bite incidents")} value={sightings.filter((item) => item.bite === "Ναι").length} tone="danger" />
        </div>
      </article>
      <AuthorityDecisionPanel selectedZone={selectedZone} forecast={forecast} authorityAction={authorityAction} />
      <DataTable title={t("Αναφορές πολιτών", "Citizen reports")} rows={sightings} type="sighting" />
      <DataTable title={t("Ποσότητες ανά λιμάνι", "Quantities by port")} rows={catches} type="catch" />
    </section>
  );
}

function AuthorityDecisionPanel({ selectedZone, forecast, authorityAction }) {
  const { t, lang } = useLang();
  const en = lang === "en";
  const title = en && authorityAction.titleEn ? authorityAction.titleEn : authorityAction.title;
  const reason = en && authorityAction.reasonEn ? authorityAction.reasonEn : authorityAction.reason;
  const publicMessage = en && authorityAction.publicMessageEn ? authorityAction.publicMessageEn : authorityAction.publicMessage;
  const protocol = en && authorityAction.protocolEn ? authorityAction.protocolEn : authorityAction.protocol;
  return (
    <article className="info-panel wide decision-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("Authority copilot", "Authority copilot")}</p>
          <h3>{t("Προτεινόμενη επιχειρησιακή απόφαση", "Recommended operational decision")}</h3>
        </div>
        <Megaphone size={22} aria-hidden="true" />
      </div>
      <div className="decision-layout">
        <div>
          <span className={`action-level ${authorityAction.level}`}>{title}</span>
          <p>{reason}</p>
          <div className="alert-draft">
            <strong>{t("Κείμενο ειδοποίησης", "Alert text")}</strong>
            <p>
              {t(
                `Προσοχή: ${publicMessage} Περιοχή: ${selectedZone.area}. Πρόβλεψη 72h: ${forecast[2].score}/100. Μην αγγίζετε και μην καταναλώνετε άγνωστα ψάρια.`,
                `Warning: ${publicMessage} Area: ${selectedZone.area}. 72h forecast: ${forecast[2].score}/100. Do not touch or eat unfamiliar fish.`
              )}
            </p>
          </div>
        </div>
        <div className="protocol-list">
          {protocol.map((step) => (
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
  const { t } = useLang();
  return (
    <section className="panel-grid">
      <article className="info-panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Admin panel</p>
            <h2>{t("Έλεγχος αναφορών και φωτογραφιών", "Review of reports and photos")}</h2>
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
          <h3>{t("Ουρά ελέγχου", "Review queue")}</h3>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("Περιοχή", "Area")}</th>
                <th>AI</th>
                <th>{t("Κατάσταση", "Status")}</th>
                <th>{t("Ενέργειες", "Actions")}</th>
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
                      <button type="button" className="icon-action approve" title={t("Έγκριση", "Approve")} onClick={() => updateSighting(item.id, "verified")}>
                        <CheckCircle2 size={17} aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-action reject" title={t("Απόρριψη", "Reject")} onClick={() => updateSighting(item.id, "rejected")}>
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
  const { t, lang } = useLang();
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
                <th>{t("Σκάφος", "Vessel")}</th>
                <th>{t("Λιμάνι", "Port")}</th>
                <th>{t("Κιλά", "Kg")}</th>
                <th>{t("Περιοχή", "Area")}</th>
                <th>{t("Κατάσταση", "Status")}</th>
              </tr>
            ) : (
              <tr>
                <th>ID</th>
                <th>{t("Περιοχή", "Area")}</th>
                <th>{t("Πηγή", "Source")}</th>
                <th>AI</th>
                <th>{t("Δάγκωμα", "Bite")}</th>
                <th>{t("Κατάσταση", "Status")}</th>
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
                  <td>{catchStatusLabel(item.status, lang)}</td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.area}</td>
                  <td>{sourceLabel(item.source, lang)}</td>
                  <td>{item.ai}%</td>
                  <td>{biteLabel(item.bite, lang)}</td>
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
  const { lang } = useLang();
  return <span className={`status-badge ${status}`}>{statusLabel(status, lang)}</span>;
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
      reason: "Συνδυασμός πρόσφατων αναφορών και θαλάσσιας θερμοκρασίας.",
      reasonEn: "Combination of recent reports and sea temperature."
    },
    {
      label: "48h",
      score: clampScore(base + trend * 1.7 - 2),
      reason: "Μεταφορά πιθανότητας με ρεύματα και ιστορικό hotspots.",
      reasonEn: "Probability transported by currents and hotspot history."
    },
    {
      label: "72h",
      score: clampScore(base + trend * 2.2 - 5),
      reason: "Προβολή κινδύνου με seasonality, βάθος και αλιευτικά δεδομένα.",
      reasonEn: "Risk projection using seasonality, depth and fishing data."
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
  forecast.recommendationEn =
    forecast[2].score >= 88
      ? "Immediate alert"
      : forecast[2].score >= 72
        ? "Heightened watch"
        : forecast[2].score >= 50
          ? "Preventive monitoring"
          : "Routine surveillance";
  return forecast;
}

function buildAuthorityAction(zone, forecast) {
  const peak = Math.max(zone.risk, ...forecast.map((item) => item.score));
  if (peak >= 88 || zone.bites > 0) {
    return {
      level: "critical",
      title: "Έκδοση άμεσης προειδοποίησης",
      titleEn: "Issue an immediate warning",
      publicMessage: "αυξημένη πιθανότητα παρουσίας λαγοκέφαλου και ανάγκη άμεσης προσοχής.",
      publicMessageEn: "increased likelihood of pufferfish presence and a need for immediate caution.",
      reason: "Το σύστημα συνδυάζει υψηλό risk score, επιβεβαιωμένες αναφορές και σοβαρούς δείκτες συμβάντων.",
      reasonEn: "The system combines a high risk score, confirmed reports and serious incident indicators.",
      protocol: [
        "Ενημέρωση ναυαγοσωστών και λιμενικών αρχών",
        "Ανάρτηση προειδοποίησης σε ακτές και ψηφιακά κανάλια",
        "Επικοινωνία με αλιευτικούς συλλόγους",
        "Ενεργοποίηση καθημερινής αναφοράς φορέα"
      ],
      protocolEn: [
        "Notify lifeguards and coast-guard authorities",
        "Post a warning on beaches and digital channels",
        "Contact fishing associations",
        "Activate a daily authority report"
      ]
    };
  }
  if (peak >= 70) {
    return {
      level: "high",
      title: "Αυξημένη επιτήρηση περιοχής",
      titleEn: "Increased area surveillance",
      publicMessage: "αυξημένη πιθανότητα παρουσίας λαγοκέφαλου στην ευρύτερη περιοχή.",
      publicMessageEn: "increased likelihood of pufferfish presence in the wider area.",
      reason: "Η πρόβλεψη 72h δείχνει αυξητική τάση και χρειάζεται στενότερη παρακολούθηση.",
      reasonEn: "The 72h forecast shows a rising trend and closer monitoring is needed.",
      protocol: [
        "Στοχευμένη ενημέρωση παραλιών",
        "Έλεγχος νέων φωτογραφιών από admin",
        "Συγκέντρωση δηλώσεων αλιέων",
        "Επανυπολογισμός risk score ανά 6 ώρες"
      ],
      protocolEn: [
        "Targeted beach updates",
        "Admin review of new photos",
        "Collect fishermen declarations",
        "Recalculate risk score every 6 hours"
      ]
    };
  }
  return {
    level: "normal",
    title: "Συνέχιση παρακολούθησης",
    titleEn: "Continue monitoring",
    publicMessage: "χαμηλή έως μέτρια πιθανότητα, με σύσταση προσοχής.",
    publicMessageEn: "low to moderate likelihood, with a recommendation for caution.",
    reason: "Τα δορυφορικά και επιβεβαιωμένα δεδομένα δεν δείχνουν άμεση ανάγκη συναγερμού.",
    reasonEn: "Satellite and confirmed data do not indicate an immediate need for an alert.",
    protocol: [
      "Διατήρηση κανονικής επιτήρησης",
      "Έλεγχος νέων αναφορών πολιτών",
      "Εβδομαδιαία σύνοψη φορέα",
      "Προληπτική ενημέρωση όταν αυξηθεί το score"
    ],
    protocolEn: [
      "Maintain normal surveillance",
      "Review new citizen reports",
      "Weekly authority summary",
      "Preventive update when the score rises"
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

function statusLabel(status, lang = "el") {
  if (lang === "en") {
    if (status === "verified") return "confirmed";
    if (status === "rejected") return "rejected";
    return "under review";
  }
  if (status === "verified") return "επιβεβαιώθηκε";
  if (status === "rejected") return "απορρίφθηκε";
  return "σε έλεγχο";
}

// Κατάσταση δήλωσης αλίευσης (Greek data values) → δίγλωσσο label
function catchStatusLabel(status, lang = "el") {
  if (lang !== "en") return status;
  const map = {
    "δηλώθηκε": "declared",
    "ελέγχεται": "under review",
    "εγκρίθηκε": "approved",
  };
  return map[status] || status;
}

// Πηγή αναφοράς (Greek data values) → δίγλωσσο label
function sourceLabel(source, lang = "el") {
  if (lang !== "en") return source;
  const map = {
    "Πολίτης": "Citizen",
    "Λουόμενος": "Swimmer",
    "Ψαράς": "Fisherman",
  };
  return map[source] || source;
}

// Δάγκωμα Ναι/Όχι → δίγλωσσο label
function biteLabel(bite, lang = "el") {
  if (lang !== "en") return bite;
  if (bite === "Ναι") return "Yes";
  if (bite === "Όχι") return "No";
  return bite;
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
    <A11yProvider>
      <App />
    </A11yProvider>
  </LangProvider>
);
