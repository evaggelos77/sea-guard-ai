// ============================================================================
// EV SEA GUARD AI — Πραγματικά δεδομένα (keyless, απευθείας από browser, CORS)
// ----------------------------------------------------------------------------
//  Πηγές:
//   • Open-Meteo Marine API — θερμοκρασία επιφάνειας θάλασσας (SST), ρεύματα,
//     ύψος κύματος + πρόγνωση 72h. Δωρεάν, χωρίς κλειδί.
//     https://open-meteo.com/en/docs/marine-weather-api
//   • GBIF Occurrence API — ΠΡΑΓΜΑΤΙΚΕΣ καταγραφές του είδους
//     Lagocephalus sceleratus (ασημόλαγκος / λαγοκέφαλος). Δωρεάν, χωρίς κλειδί.
//     https://www.gbif.org/species/2407758
//
//  Όλος ο μηχανισμός υπολογισμού κινδύνου είναι διαφανής και τεκμηριωμένος.
//  ΔΕΝ ισχυριζόμαστε ότι «βλέπουμε» κάθε ψάρι — εκτιμούμε καταλληλότητα
//  ενδιαιτήματος (habitat suitability) από θερμοκρασία + πραγματική παρουσία.
// ============================================================================

export const LAGOCEPHALUS_TAXON_KEY = 2407758; // GBIF: Lagocephalus sceleratus (Gmelin, 1789)

const lerp = (a, b, x) => a + (b - a) * Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------------------
// 1) Καταλληλότητα ενδιαιτήματος από SST
// Ο λαγοκέφαλος είναι θερμόφιλο λεσσεψιανό είδος. Βιβλιογραφία (HCMR/iSea,
// Mediterranean): θερμική ανοχή ~14–31°C, μέγιστη δραστηριότητα & αναπαραγωγή
// ~22–28°C, ψυχρά νερά (<~14°C) τον περιορίζουν.
// Επιστρέφει 0..1.
// ---------------------------------------------------------------------------
export function sstSuitability(t) {
  if (t == null || Number.isNaN(t)) return null;
  if (t < 13) return 0.03;
  if (t < 18) return lerp(0.03, 0.45, (t - 13) / 5); // 13 → 18
  if (t < 22) return lerp(0.45, 0.85, (t - 18) / 4); // 18 → 22
  if (t <= 28) return lerp(0.85, 1.0, (t - 22) / 6); // 22 → 28 (κορύφωση)
  if (t <= 31) return lerp(1.0, 0.82, (t - 28) / 3); // 28 → 31 (ήπια πτώση)
  return 0.7;
}

// Κανονικοποίηση πραγματικής παρουσίας (GBIF) σε 0..1 με λογαριθμική κλίμακα:
// ~25 πρόσφατες καταγραφές κοντά ⇒ κορεσμός (εδραιωμένος πληθυσμός).
function occurrenceSignal(recentCount, totalCount) {
  const recent = Math.min(1, Math.log10(1 + (recentCount || 0)) / Math.log10(1 + 25));
  const ever = Math.min(1, Math.log10(1 + (totalCount || 0)) / Math.log10(1 + 60));
  // βαρύτητα στις πρόσφατες, με «μνήμη» από το σύνολο
  return Math.max(recent, 0.55 * recent + 0.45 * ever);
}

// Κανονικοποίηση σήματος κοινότητας (αναφορές πολιτών + κιλά αλιέων κοντά).
function communitySignal(localReports, localKg, bites) {
  const r = Math.min(1, (localReports || 0) / 8);
  const k = Math.min(1, (localKg || 0) / 200);
  const b = Math.min(1, (bites || 0) * 0.5);
  return Math.max(b, 0.6 * r + 0.4 * k);
}

// Επιστρέφει αναγνώσιμο χρώμα κειμένου (σχεδόν μαύρο ή λευκό) για ένα χρώμα φόντου κινδύνου,
// επιλέγοντας αυτό με τη μεγαλύτερη αντίθεση (WCAG). Λύνει τα λευκά-σε-κίτρινο που δεν διαβάζονταν.
export function riskInk(hex) {
  try {
    const c = String(hex).replace("#", "");
    if (c.length < 6) return "#0b1f25";
    const toLin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const r = toLin(parseInt(c.slice(0, 2), 16));
    const g = toLin(parseInt(c.slice(2, 4), 16));
    const b = toLin(parseInt(c.slice(4, 6), 16));
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const cWhite = 1.05 / (L + 0.05);
    const cBlack = (L + 0.05) / 0.05;
    return cBlack >= cWhite ? "#0b1f25" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

export function classifyRisk(score) {
  if (score >= 82) return { level: "Πολύ υψηλό", color: "#c0202a", tone: "danger" };
  if (score >= 66) return { level: "Υψηλό", color: "#e73d3d", tone: "danger" };
  if (score >= 48) return { level: "Μέτριο προς υψηλό", color: "#f08c2e", tone: "warn" };
  if (score >= 30) return { level: "Μέτριο", color: "#e6c84f", tone: "warn" };
  return { level: "Χαμηλό", color: "#2fa66a", tone: "default" };
}

const clamp100 = (v) => Math.max(0, Math.min(100, Math.round(v)));

// ---------------------------------------------------------------------------
// 2) Open-Meteo Marine — τρέχουσες συνθήκες + SST σε +24/48/72h
// ---------------------------------------------------------------------------
const MARINE_VARS = "sea_surface_temperature,ocean_current_velocity,ocean_current_direction,wave_height";

function parseMarine(j) {
  if (!j) return null;
  const cur = j.current || {};
  const hourly = j.hourly || {};
  const series = hourly.sea_surface_temperature || [];
  const times = hourly.time || [];
  let idxNow = 0;
  if (cur.time) {
    const prefix = String(cur.time).slice(0, 13); // "YYYY-MM-DDTHH"
    const found = times.findIndex((t) => String(t).slice(0, 13) === prefix);
    if (found >= 0) idxNow = found;
  }
  const at = (h) => series[Math.min(series.length - 1, idxNow + h)] ?? null;
  return {
    sst: cur.sea_surface_temperature ?? at(0),
    currentVel: cur.ocean_current_velocity ?? null,
    currentDir: cur.ocean_current_direction ?? null,
    wave: cur.wave_height ?? null,
    sst24: at(24),
    sst48: at(48),
    sst72: at(72),
    units: j.current_units || {},
  };
}

export async function fetchMarine(lat, lon, signal) {
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&current=${MARINE_VARS}&hourly=sea_surface_temperature&forecast_days=4&timezone=auto`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`marine ${res.status}`);
  return parseMarine(await res.json());
}

// Batch: πολλές τοποθεσίες σε ΜΙΑ κλήση (το Open-Meteo δέχεται comma-separated lat/lon)
// coordList: [[lat, lon], ...] → επιστρέφει [marine|null, ...] στην ίδια σειρά.
export async function fetchMarineBatch(coordList, signal) {
  if (!coordList.length) return [];
  const lats = coordList.map((c) => c[0]).join(",");
  const lons = coordList.map((c) => c[1]).join(",");
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}` +
    `&current=${MARINE_VARS}&hourly=sea_surface_temperature&forecast_days=4&timezone=auto`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`marine batch ${res.status}`);
  const j = await res.json();
  const arr = Array.isArray(j) ? j : [j];
  return arr.map(parseMarine);
}

// ---------------------------------------------------------------------------
// 3) GBIF — πραγματικές καταγραφές λαγοκέφαλου σε τοπικό «κουτί» γύρω από ζώνη
// ---------------------------------------------------------------------------
export async function fetchOccurrences(lat, lon, signal, halfDeg = 0.7) {
  const latMin = (lat - halfDeg).toFixed(3);
  const latMax = (lat + halfDeg).toFixed(3);
  const lonMin = (lon - halfDeg).toFixed(3);
  const lonMax = (lon + halfDeg).toFixed(3);
  const base =
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${LAGOCEPHALUS_TAXON_KEY}&hasCoordinate=true` +
    `&decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}`;

  const yNow = new Date().getFullYear();
  const [totalR, recentR] = await Promise.all([
    fetch(`${base}&limit=0`, { signal }),
    fetch(`${base}&year=${yNow - 3},${yNow}&limit=0`, { signal }),
  ]);
  if (!totalR.ok || !recentR.ok) throw new Error("gbif occurrences");
  const total = (await totalR.json()).count || 0;
  const recent = (await recentR.json()).count || 0;
  return { total, recent };
}

// Πραγματικά σημεία GBIF για ΟΛΗ την Ελλάδα (paginated — έως pages×300).
// Χρησιμοποιούνται και για τον χάρτη ΚΑΙ για υπολογισμό παρουσίας ανά ζώνη (binning),
// ώστε να μη χρειάζονται δεκάδες κλήσεις GBIF με πολλές ζώνες.
// Παράθυρο ΑΚΡΙΒΩΣ 3 ετών ώστε να ταιριάζει με την ετικέτα «καταγραφές/3ετία»
// και να δείχνει την ΠΡΟΣΦΑΤΗ (ξαφνική) εμφάνιση του είδους.
export async function fetchOccurrencePoints(signal, pages = 3) {
  const yNow = new Date().getFullYear();
  const base =
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${LAGOCEPHALUS_TAXON_KEY}&hasCoordinate=true` +
    `&decimalLatitude=34,42&decimalLongitude=19,30&year=${yNow - 3},${yNow}&limit=300`;
  const out = [];
  for (let p = 0; p < pages; p++) {
    const res = await fetch(`${base}&offset=${p * 300}`, { signal });
    if (!res.ok) break;
    const j = await res.json();
    const results = j.results || [];
    for (const r of results) {
      if (r.decimalLatitude != null && r.decimalLongitude != null) {
        out.push({ lat: r.decimalLatitude, lng: r.decimalLongitude, year: r.year || null });
      }
    }
    if (results.length < 300 || j.endOfRecords) break;
  }
  return out;
}

// Πλήρες ιστορικό καταγραφών GBIF (από fromYear έως σήμερα) — για τη «χρονομηχανή εξάπλωσης».
export async function fetchOccurrenceHistory(signal, fromYear = 2005, pages = 8) {
  const yNow = new Date().getFullYear();
  const base =
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${LAGOCEPHALUS_TAXON_KEY}&hasCoordinate=true` +
    `&decimalLatitude=34,42&decimalLongitude=19,30&year=${fromYear},${yNow}&limit=300`;
  const out = [];
  for (let p = 0; p < pages; p++) {
    const res = await fetch(`${base}&offset=${p * 300}`, { signal });
    if (!res.ok) break;
    const j = await res.json();
    const results = j.results || [];
    for (const r of results) {
      if (r.decimalLatitude != null && r.decimalLongitude != null && r.year) {
        out.push({ lat: r.decimalLatitude, lng: r.decimalLongitude, year: r.year });
      }
    }
    if (results.length < 300 || j.endOfRecords) break;
  }
  return out;
}

// Μετράει πραγματικές καταγραφές σε «κουτί» γύρω από συντεταγμένη (για το σήμα παρουσίας).
export function countPointsNear(points, lat, lon, halfDeg = 0.55) {
  let n = 0;
  for (const pt of points) {
    if (Math.abs(pt.lat - lat) <= halfDeg && Math.abs(pt.lng - lon) <= halfDeg) n += 1;
  }
  return n;
}

// Geocoding (Open-Meteo, keyless): ΟΠΟΙΑΔΗΠΟΤΕ ελληνική περιοχή/παραλία → συντεταγμένες.
// Έτσι η αναζήτηση δουλεύει για ΟΛΗ την Ελλάδα, όχι μόνο τις προκαθορισμένες ζώνες.
export async function geocodeGreece(name, signal) {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}` +
    `&count=8&language=el&countryCode=GR`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const j = await res.json();
  const results = (j.results || []).filter((r) => r.country_code === "GR");
  if (!results.length) return null;
  // προτίμησε αποτέλεσμα κοντά στη θάλασσα/μέσα στο ελληνικό πλαίσιο
  const inBox = results.filter(
    (r) => r.longitude >= 19 && r.longitude <= 30.5 && r.latitude >= 34.5 && r.latitude <= 41.9
  );
  const top = inBox[0] || results[0];
  return { name: top.name, lat: top.latitude, lon: top.longitude, admin: top.admin1 || "" };
}

// ---------------------------------------------------------------------------
// 4) Σύνθεση ζωντανού κινδύνου ζώνης (διαφανής, σταθμισμένος συνδυασμός)
//    risk = 100 × (0.45·SST + 0.35·Παρουσία + 0.20·Κοινότητα)
// ---------------------------------------------------------------------------
const W_SST = 0.45;
const W_OCC = 0.35;
const W_COM = 0.2;

export function computeLiveZone({ marine, occ, localReports = 0, localKg = 0, bites = 0 }) {
  const sSst = sstSuitability(marine?.sst);
  const sOcc = occurrenceSignal(occ?.recent, occ?.total);
  const sCom = communitySignal(localReports, localKg, bites);

  // αν λείπει SST, αναδιανέμουμε τη βαρύτητα στα υπόλοιπα
  let risk;
  if (sSst == null) {
    risk = 100 * ((W_OCC * sOcc + W_COM * sCom) / (W_OCC + W_COM));
  } else {
    risk = 100 * (W_SST * sSst + W_OCC * sOcc + W_COM * sCom);
  }
  risk = clamp100(risk);
  const cls = classifyRisk(risk);

  // πρόγνωση 72h: η παρουσία/κοινότητα αλλάζουν αργά, ο SST οδηγεί τη μεταβολή
  const fScore = (sstFuture) => {
    const sf = sstSuitability(sstFuture);
    if (sf == null) return risk;
    return clamp100(100 * (W_SST * sf + W_OCC * sOcc + W_COM * sCom));
  };
  const forecast = [
    { label: "24h", score: fScore(marine?.sst24), reason: sstReason(marine?.sst24), reasonEn: sstReasonEn(marine?.sst24) },
    { label: "48h", score: fScore(marine?.sst48), reason: sstReason(marine?.sst48), reasonEn: sstReasonEn(marine?.sst48) },
    { label: "72h", score: fScore(marine?.sst72), reason: sstReason(marine?.sst72), reasonEn: sstReasonEn(marine?.sst72) },
  ];
  // εμπιστοσύνη AI ~ πληρότητα δεδομένων
  const dataParts = [marine?.sst != null, (occ?.total || 0) > 0, (occ?.recent || 0) > 0];
  const confidence = Math.round(
    62 + dataParts.filter(Boolean).length * 8 + Math.min(10, (occ?.recent || 0) * 0.6)
  );
  forecast.confidence = Math.min(97, confidence);
  forecast.recommendation =
    risk >= 82 ? "Άμεση ειδοποίηση" : risk >= 66 ? "Αυξημένη επιτήρηση" : risk >= 48 ? "Προληπτική παρακολούθηση" : "Κανονική επιτήρηση";
  forecast.recommendationEn =
    risk >= 82 ? "Immediate alert" : risk >= 66 ? "Heightened watch" : risk >= 48 ? "Preventive monitoring" : "Routine surveillance";

  return {
    risk,
    level: cls.level,
    color: cls.color,
    tone: cls.tone,
    sst: marine?.sst ?? null,
    sst24: marine?.sst24 ?? null,
    currentVel: marine?.currentVel ?? null,
    currentDir: marine?.currentDir ?? null,
    wave: marine?.wave ?? null,
    occTotal: occ?.total ?? 0,
    occRecent: occ?.recent ?? 0,
    satellite: marine?.sst != null ? describeSst(marine.sst) : "Δεδομένα μη διαθέσιμα",
    satelliteEn: marine?.sst != null ? describeSstEn(marine.sst) : "Data unavailable",
    recommendation: recommend(risk),
    recommendationEn: recommendEn(risk),
    breakdown: {
      sst: sSst == null ? null : Math.round(sSst * 100),
      occurrence: Math.round(sOcc * 100),
      community: Math.round(sCom * 100),
    },
    forecast,
    updatedAt: new Date().toISOString(),
  };
}

function sstReason(t) {
  if (t == null) return "Πρόγνωση SST μη διαθέσιμη.";
  if (t >= 24) return `Πολύ θερμά νερά (${t.toFixed(1)}°C) — ευνοϊκά για τον λαγοκέφαλο.`;
  if (t >= 19) return `Θερμά νερά (${t.toFixed(1)}°C) — αυξημένη δραστηριότητα.`;
  if (t >= 15) return `Χλιαρά νερά (${t.toFixed(1)}°C) — μέτρια δραστηριότητα.`;
  return `Ψυχρά νερά (${t.toFixed(1)}°C) — περιορισμένη παρουσία.`;
}

function sstReasonEn(t) {
  if (t == null) return "SST forecast unavailable.";
  if (t >= 24) return `Very warm water (${t.toFixed(1)}°C) — favourable for pufferfish.`;
  if (t >= 19) return `Warm water (${t.toFixed(1)}°C) — increased activity.`;
  if (t >= 15) return `Mild water (${t.toFixed(1)}°C) — moderate activity.`;
  return `Cold water (${t.toFixed(1)}°C) — limited presence.`;
}

function describeSst(t) {
  if (t >= 26) return `SST ${t.toFixed(1)}°C — πολύ ευνοϊκές συνθήκες`;
  if (t >= 22) return `SST ${t.toFixed(1)}°C — ευνοϊκές συνθήκες`;
  if (t >= 18) return `SST ${t.toFixed(1)}°C — ήπια ευνοϊκές`;
  if (t >= 15) return `SST ${t.toFixed(1)}°C — οριακές συνθήκες`;
  return `SST ${t.toFixed(1)}°C — μη ευνοϊκές`;
}

function recommend(risk) {
  if (risk >= 82) return "Άμεση ενημέρωση λουόμενων, παιδιών, κατοικίδιων και αλιέων. Συστήνεται ανακοίνωση φορέα.";
  if (risk >= 66) return "Προσοχή σε λουόμενους και ψαράδες. Μην αγγίζετε άγνωστα ψάρια.";
  if (risk >= 48) return "Αυξημένη πιθανότητα παρουσίας. Προληπτική ενημέρωση και παρακολούθηση.";
  if (risk >= 30) return "Μέτρια πιθανότητα. Συνεχίζεται η παρακολούθηση.";
  return "Χαμηλή πιθανότητα παρουσίας αυτή την περίοδο. Συνεχής επιτήρηση.";
}

function recommendEn(risk) {
  if (risk >= 82) return "Alert swimmers, children, pets and fishermen. A public notice is recommended.";
  if (risk >= 66) return "Caution for swimmers and fishermen. Do not touch unfamiliar fish.";
  if (risk >= 48) return "Elevated likelihood of presence. Preventive awareness and monitoring.";
  if (risk >= 30) return "Moderate likelihood. Monitoring continues.";
  return "Low likelihood of presence this period. Ongoing surveillance.";
}

function describeSstEn(t) {
  if (t >= 26) return `SST ${t.toFixed(1)}°C — very favourable conditions`;
  if (t >= 22) return `SST ${t.toFixed(1)}°C — favourable conditions`;
  if (t >= 18) return `SST ${t.toFixed(1)}°C — mildly favourable`;
  if (t >= 15) return `SST ${t.toFixed(1)}°C — marginal conditions`;
  return `SST ${t.toFixed(1)}°C — unfavourable`;
}
