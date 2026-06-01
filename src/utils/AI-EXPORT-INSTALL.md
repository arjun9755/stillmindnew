# KI-Export Integration — Installationsanleitung
# StillMind · ai-export.js + Patches

## ÜBERSICHT

Was du kriegst:
  - utils/ai-export.js              → KI-Utility (Kern-Modul, einfach kopieren)
  - utils/ai-export-statistik-patch.js  → Anleitung was in statistik/index.jsx ändern
  - utils/ai-export-sharecard-patch.js  → Anleitung was in session-result/[id].jsx ändern

---

## SCHRITT 1 — API Key einrichten

In deiner .env (oder app.config.js):

  EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...

WICHTIG: Nur EXPO_PUBLIC_ Prefix macht den Key für das Frontend sichtbar.
Der Key wird direkt vom Gerät zur Anthropic API gesendet.
→ Für Produktion empfehle ich einen Backend-Proxy (aber für den Start ist das fine).

---

## SCHRITT 2 — ai-export.js kopieren

  cp utils/ai-export.js src/utils/ai-export.js

Fertig. Das Modul hat keine weiteren Abhängigkeiten außer:
  - @react-native-async-storage/async-storage  (bereits in deinem Projekt)
  - fetch (global in React Native)

---

## SCHRITT 3 — statistik/index.jsx patchen

Öffne app/(tabs)/statistik/index.jsx und mach folgende 6 Änderungen:

### 3a) Import hinzufügen (ganz oben, mit den anderen imports)
```js
import {
  getAiYearInsight,
  getAiMonthInsight,
  getAiCsvComments,
  aiInsightStatus,
} from "@/utils/ai-export";
```

### 3b) State hinzufügen (in der Komponente, nach den useState-Zeilen)
Aus ai-export-statistik-patch.js: Block B komplett kopieren.

### 3c) useEffect + loadAiYearInsight hinzufügen
Aus ai-export-statistik-patch.js: Block B (Fortsetzung) kopieren.

### 3d) buildLuxuryReportHtml Signatur ändern
```js
// ALT:
const buildLuxuryReportHtml = useCallback((periodLabel) => {
// NEU:
const buildLuxuryReportHtml = useCallback((periodLabel, aiInsightText = null) => {
```

### 3e) Seite 6 in buildLuxuryReportHtml einfügen
Füge VOR dem schließenden `</body></html>\`` am Ende des HTML-Strings ein:
```js
${AI_PAGE_HTML(aiInsightText, userName, year, createdDate)}
```

(AI_PAGE_HTML ist die Funktion aus Block D der Patch-Datei — in die Komponente kopieren)

### 3f) PDF-Button austauschen
Den bestehenden PDF-Button-Block:
```
<TouchableOpacity onPress={async()=>{ if (plan !== "lifetime") ...
```
ersetzen durch: `<PdfExportButton />`
(PdfExportButton aus Block E der Patch-Datei in die Komponente kopieren)

### 3g) runCsvExport ersetzen
Bestehende runCsvExport Funktion ersetzen durch: runCsvExportWithAi aus Block F.
Alle Aufrufe von runCsvExport( durch runCsvExportWithAi( ersetzen.

---

## SCHRITT 4 — session-result/[id].jsx patchen

### 4a) Import hinzufügen
```js
import { getAiShareSentence } from "@/utils/ai-export";
```

### 4b) State + useEffect einfügen
Aus ai-export-sharecard-patch.js: Block B und C kopieren.

### 4c) KI-Satz in der Share Card anzeigen
Aus ai-export-sharecard-patch.js: Block D in die Share Card JSX einfügen.
Position: nach dem Session-Titel, vor den Buttons.

---

## SCHRITT 5 — Testen

```bash
npx expo start --clear
```

Dann:
1. Als Lifetime-Nutzer einloggen (Dev-Override)
2. Statistik-Tab öffnen → auf PDF-Button tippen
3. "KI-Analyse lädt…" sollte ~2-4 Sekunden erscheinen
4. PDF öffnet mit 6 Seiten (Seite 6 = KI-Rückblick)

Share Card:
1. Session abschließen
2. Auf Share tippen
3. Unter dem Zitat erscheint kursiver KI-Satz

CSV:
1. CSV Export wählen
2. Als Lifetime: CSV hat Spalte "KI-Reflexion" für letzte 30 Sessions

---

## KOSTEN & PERFORMANCE

Modell: claude-haiku-4-5 (schnellstes, günstigstes Modell)

| Feature          | Tokens   | Kosten/Request | Häufigkeit         |
|------------------|----------|----------------|--------------------|
| Jahresbericht    | ~600 in + ~400 out | ~$0.0002 | 1× pro Jahr (gecacht) |
| Share Card Satz  | ~150 in + ~80 out  | ~$0.00004 | 1× pro Session (gecacht) |
| Monatsrückblick  | ~300 in + ~250 out | ~$0.0001 | 1× pro Monat (gecacht) |
| CSV Kommentare   | ~400 in + ~400 out | ~$0.0002 | 1× pro Export (gecacht) |

→ Kosten pro aktiven Lifetime-Nutzer/Monat: ca. $0.001–0.003
→ Bei 1.000 Lifetime-Nutzern: ~$1–3/Monat

Cache-Strategie:
  - Jahresbericht: 30 Tage TTL
  - Monatsrückblick: 30 Tage TTL  
  - Share Card: permanent (ändert sich nie)
  - CSV-Kommentare: permanent pro Session

---

## FALLBACK-VERHALTEN

Alle KI-Funktionen geben null zurück wenn:
  - Kein API Key gesetzt
  - Netzwerk nicht verfügbar
  - API Fehler / Timeout

→ PDF hat dann 5 Seiten statt 6 (keine KI-Seite)
→ Share Card zeigt normales Quote statt KI-Satz
→ CSV hat keine "KI-Reflexion" Spalte

Das ist gewollt und wichtig — Export muss immer funktionieren.

---

## BACKEND-PROXY (Optional, empfohlen für Produktion)

Statt direktem API-Zugriff vom Gerät:

1. Kleiner Proxy-Endpunkt (z.B. Cloudflare Worker, Vercel Edge):
```js
// Nimmt POST { prompt } → leitet an Anthropic weiter → gibt text zurück
// API-Key bleibt serverseitig, Nutzer sieht ihn nie
```

2. In ai-export.js die API_URL anpassen:
```js
const API_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || "https://api.anthropic.com/v1/messages";
```

Für den Start (Beta/Testphase) ist der direkte Zugriff ok.
