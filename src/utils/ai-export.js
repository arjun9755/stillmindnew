/**
 * utils/ai-export.js
 * ─────────────────────────────────────────────────────────────────────────────
 * KI-gestützter Content-Layer für alle StillMind Exports.
 *
 * Was es macht:
 *  1. Generiert persönlichen Rückblick-Text für den Jahresbericht (PDF Seite 6)
 *  2. Generiert einen Satz für die Share Card nach jeder Session
 *  3. Generiert einen Monatsrückblick-Text für Monatsbericht PDF
 *  4. Cacht alle generierten Texte lokal (AsyncStorage) — max. 1× pro Monat
 *
 * KI-Schnittstelle: Anthropic Messages API (direkt, kein Backend nötig)
 * Modell: claude-haiku-4-5-20251001 (schnell + günstig für kurze Texte)
 * Tokens: ~400–800 pro Request → ca. $0.001–0.002 pro User/Monat
 *
 * Verwendung:
 *  import { getAiYearInsight, getAiShareSentence, getAiMonthInsight } from "@/utils/ai-export";
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Modell & Endpunkt ──────────────────────────────────────────────────────
const API_URL   = "https://api.anthropic.com/v1/messages";
const API_MODEL = "claude-haiku-4-5";   // schnell + günstig
const API_KEY   = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || "";

// ── Cache-Keys ─────────────────────────────────────────────────────────────
const CACHE_YEAR_KEY  = (year)  => `ai_year_insight_${year}`;
const CACHE_MONTH_KEY = (ym)    => `ai_month_insight_${ym}`;  // z.B. "2025-01"
const CACHE_SHARE_KEY = (sesId) => `ai_share_sentence_${sesId}`;

// ── Interner API-Aufruf ────────────────────────────────────────────────────
async function callClaude(systemPrompt, userPrompt, maxTokens = 300) {
  if (!API_KEY) throw new Error("EXPO_PUBLIC_ANTHROPIC_API_KEY nicht gesetzt.");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "x-api-key":            API_KEY,
      "anthropic-version":    "2023-06-01",
    },
    body: JSON.stringify({
      model:      API_MODEL,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API Error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data && data.content && data.content[0] && data.content[0].text && data.content[0].text.trim()) || "";
}

// ── Cache helpers ──────────────────────────────────────────────────────────
async function fromCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    return { text, ts };
  } catch (_e) {
    return null;
  }
}

async function toCache(key, text) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ text, ts: Date.now() }));
  } catch (_e) {}
}

// Maximal 30 Tage alt
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cacheValid(ts) {
  return ts && Date.now() - ts < CACHE_TTL_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. JAHRESBERICHT — persönlicher Rückblick (PDF Seite 6)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Gibt einen personalisierten deutschen Rückblick-Text zurück (ca. 200 Wörter)
 * der in die 6. PDF-Seite eingebettet wird.
 *
 * @param {object} stats  - { totalSessions, totalMinutes, uniqueDays, longestStreak,
 *                            bestMonthLabel, bestMonthSessions, avgMin,
 *                            bestTodLabel, moodBesserPct, topModeName, userName }
 * @param {number} year   - Kalenderjahr
 * @returns {Promise<string>} - Deutschen Fließtext, ~150–220 Wörter
 */
export async function getAiYearInsight(stats, year) {
  const cacheKey = CACHE_YEAR_KEY(year);
  const cached   = await fromCache(cacheKey);
  if (cached && cacheValid(cached.ts)) return cached.text;

  const system = `Du bist ein einfühlsamer, ruhiger Begleiter für Meditation und Achtsamkeit.
Du schreibst einen persönlichen Jahresrückblick für einen Meditationsapp-Nutzer.
Ton: warm, ehrlich, motivierend — nie kitschig. Kein Marketing-Sprech.
Länge: exakt 3 Absätze, je 2–4 Sätze. Gesamt ca. 150–200 Wörter.
Sprache: Deutsch, du-Form.
Format: Nur Fließtext, keine Überschriften, keine Aufzählungen, keine Anführungszeichen.`;

  const user = `Schreibe einen persönlichen Jahresrückblick für ${stats.userName || "den Nutzer"}.

Statistiken des Jahres ${year}:
- ${stats.totalSessions} Sessions insgesamt
- ${stats.totalMinutes} Minuten Stille
- ${stats.uniqueDays} aktive Tage
- Längster Streak: ${stats.longestStreak} Tage am Stück
- Stärkster Monat: ${stats.bestMonthLabel} (${stats.bestMonthSessions} Sessions)
- Liebste Tageszeit: ${stats.bestTodLabel}
- Stimmung danach verbessert: ${stats.moodBesserPct}% der Sessions
- Meistgenutzter Modus: ${stats.topModeName}
- Durchschnittliche Session: ${stats.avgMin} Minuten

Der Text soll die persönliche Reise widerspiegeln, konkrete Zahlen einbeziehen und
mit einem motivierenden Ausblick auf das nächste Jahr enden.`;

  try {
    const text = await callClaude(system, user, 400);
    await toCache(cacheKey, text);
    return text;
  } catch (e) {
    console.warn("[AI Year Insight]", e.message);
    return null; // Fallback: kein Text — PDF rendert ohne KI-Seite
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. SHARE CARD — ein persönlicher Satz nach der Session
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generiert einen kurzen, geteilbaren Satz für die Share Card.
 * Wird pro Session gecacht (SessionID als Key).
 *
 * @param {object} sessionData - { sessionTitle, durationMin, mood, note,
 *                                  timeOfDay, userName, modeName }
 * @param {string} sessionId   - Unique ID der Session für Cache
 * @returns {Promise<string>} - 1 Satz, max. 120 Zeichen
 */
export async function getAiShareSentence(sessionData, sessionId) {
  const cacheKey = CACHE_SHARE_KEY(sessionId);
  const cached   = await fromCache(cacheKey);
  if (cached) return cached.text; // Share-Satz: immer gecacht, kein TTL

  const system = `Du schreibst einen kurzen, persönlichen Satz für eine Social-Media-Karte
nach einer Meditations-Session. Ton: ruhig, authentisch, nicht überschwänglich.
Maximal 120 Zeichen. Kein Hashtag. Keine Anführungszeichen. Deutsch, du-Form.
Nur der Satz — nichts anderes.`;

  const moodText = {
    "😌": "danach deutlich besser",
    "🙂": "etwas erleichterter",
    "😐": "neutral — der Kopf ist klarer",
    "😕": "es war schwerer heute",
    "😣": "es war ein schwieriger Moment",
  }[sessionData.mood] || "";

  const user = `Session: "${sessionData.sessionTitle}"
Dauer: ${sessionData.durationMin} Minuten
Tageszeit: ${sessionData.timeOfDay}
Stimmung danach: ${moodText}
${sessionData.note ? `Notiz: "${sessionData.note}"` : ""}

Schreibe einen einzigen Satz der diese Session einfängt.`;

  try {
    const text = await callClaude(system, user, 80);
    const cleaned = text.replace(/^["»«]|["»«]$/g, "").trim();
    await toCache(cacheKey, cleaned);
    return cleaned;
  } catch (e) {
    console.warn("[AI Share Sentence]", e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. MONATSBERICHT — Rückblick-Text für den Monat (PDF + Reflexions-Screen)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generiert einen Monatlichen Rückblick-Text.
 * Gecacht für 30 Tage pro Monat.
 *
 * @param {object} monthStats  - { sessions, minutes, days, streak,
 *                                  moodBesser, moodSchlechter,
 *                                  bestTod, topMode, userName,
 *                                  monthLabel, year }
 * @returns {Promise<string>} - 2 Absätze Deutsch, ca. 80–120 Wörter
 */
export async function getAiMonthInsight(monthStats) {
  const ym       = `${monthStats.year}-${String(monthStats.month).padStart(2, "0")}`;
  const cacheKey = CACHE_MONTH_KEY(ym);
  const cached   = await fromCache(cacheKey);
  if (cached && cacheValid(cached.ts)) return cached.text;

  const system = `Du schreibst einen kurzen monatlichen Rückblick für einen Meditationsapp-Nutzer.
Ton: persönlich, warm, auf den Punkt. Keine leeren Floskeln.
Länge: 2 kurze Absätze, insgesamt 80–120 Wörter.
Sprache: Deutsch, du-Form.
Nur Fließtext — keine Überschriften, keine Listen.`;

  const user = `Monat: ${monthStats.monthLabel} ${monthStats.year}
Nutzer: ${monthStats.userName || "du"}

Was war:
- ${monthStats.sessions} Sessions, ${monthStats.minutes} Minuten, ${monthStats.days} aktive Tage
- Stimmung verbessert: ${monthStats.moodBesser}× | verschlechtert: ${monthStats.moodSchlechter}×
- Liebste Zeit: ${monthStats.bestTod}
- Häufigster Modus: ${monthStats.topMode}
${monthStats.streak > 3 ? `- Streak von ${monthStats.streak} Tagen` : ""}

Schreibe den persönlichen Rückblick.`;

  try {
    const text = await callClaude(system, user, 250);
    await toCache(cacheKey, text);
    return text;
  } catch (e) {
    console.warn("[AI Month Insight]", e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. CSV — KI-Kommentar pro Session (Batch)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generiert für maximal N Sessions einen kurzen KI-Kommentar (5–10 Wörter).
 * Wird als Spalte "KI-Reflexion" in die CSV eingefügt.
 *
 * WICHTIG: Wird nur für die letzten 30 Sessions aufgerufen — nicht für alle.
 * Ältere Sessions bekommen keinen KI-Kommentar (Performance + Kosten).
 *
 * @param {Array}  sessions  - Array von Session-Objekten
 * @param {number} limit     - Max. Sessions die kommentiert werden (default: 30)
 * @returns {Promise<Map<string, string>>}  sessionId → Kommentar
 */
export async function getAiCsvComments(sessions, limit = 30) {
  const toProcess = sessions.slice(-limit); // nur die letzten N
  const resultMap = new Map();

  // Prüfe Cache für jede Session
  const uncached = [];
  for (const s of toProcess) {
    const key    = CACHE_SHARE_KEY(`csv_${s.id || s.timestamp}`);
    const cached = await fromCache(key);
    if (cached) {
      resultMap.set(s.id || String(s.timestamp), cached.text);
    } else {
      uncached.push(s);
    }
  }

  if (uncached.length === 0) return resultMap;

  // Batch-Prompt: alle uncached Sessions in einem API-Call
  const system = `Du schreibst ultra-kurze Kommentare (5–8 Wörter) für Meditations-Sessions.
Jede Zeile des Outputs ist: SESSION_ID|KOMMENTAR
Nichts anderes — keine Erklärungen, keine Nummerierung.
Deutsch. Ton: ruhig, präzise.`;

  const sessionLines = uncached.slice(0, 20).map(s => { // max 20 pro Call
    const mood = { "😌":"besser","🙂":"etwas besser","😐":"neutral","😕":"schwieriger","😣":"belastend" }[s.mood] || "";
    const dur  = Math.round(Number(s.elapsedSec || s.duration || 60) / 60);
    return `${s.id || s.timestamp}|${s.mode || "calm"}|${dur}min|${mood}|${s.note ? "mit Notiz" : ""}`;
  }).join("\n");

  const user = `Sessions (ID|Modus|Dauer|Stimmung|Notiz):
${sessionLines}

Schreibe für jede Zeile: SESSION_ID|Dein Kommentar`;

  try {
    const raw    = await callClaude(system, user, 400);
    const lines  = raw.split("\n").filter(l => l.includes("|"));
    for (const line of lines) {
      const [id, ...rest] = line.split("|");
      const comment = rest.join("|").trim();
      if (id && comment) {
        resultMap.set(id.trim(), comment);
        // Cache individuell
        const key = CACHE_SHARE_KEY(`csv_${id.trim()}`);
        await toCache(key, comment);
      }
    }
  } catch (e) {
    console.warn("[AI CSV Comments]", e.message);
  }

  return resultMap;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utility: Cache leeren (z.B. in Einstellungen)
// ─────────────────────────────────────────────────────────────────────────────
export async function clearAiCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const aiKeys = keys.filter(k =>
      k.startsWith("ai_year_") ||
      k.startsWith("ai_month_") ||
      k.startsWith("ai_share_")
    );
    if (aiKeys.length > 0) await AsyncStorage.multiRemove(aiKeys);
    return aiKeys.length;
  } catch (_e) {
    return 0;
  }
}

/**
 * Prüft ob ein frischer Cache für den aktuellen Monat/Jahr existiert.
 * Nützlich für "KI-Analyse vorgeladen" Badge im UI.
 */
export async function aiInsightStatus() {
  const now   = new Date();
  const year  = now.getFullYear();
  const ym    = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearC = await fromCache(CACHE_YEAR_KEY(year));
  const monC  = await fromCache(CACHE_MONTH_KEY(ym));
  return {
    yearReady:  !!(yearC && cacheValid(yearC.ts)),
    monthReady: !!(monC  && cacheValid(monC.ts)),
  };
}
