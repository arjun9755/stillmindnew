# StillMind Watch — Setup Anleitung

## Schritt 1: npm installieren

```bash
cd apps/mobile
npm install react-native-watch-connectivity
```

## Schritt 2: Watch Target in Xcode anlegen

1. Xcode öffnen → StillMind Projekt laden
2. `File → New → Target`
3. **watchOS** → **Watch App** auswählen
4. Einstellungen:
   - Product Name: `StillMindWatch`
   - Bundle Identifier: `de.stillmind.app.watchkitapp`
   - Team: HZ5K8AY94X
   - Language: Swift
   - Interface: SwiftUI
   - **"Include Notification Scene"**: ✗ (ausschalten)
5. **Activate scheme**: Ja

## Schritt 3: Swift-Dateien kopieren

Die 5 Swift-Dateien aus `modules/stillmind-watch/ios/StillMindWatch/` in den
neuen Watch App Target-Ordner in Xcode kopieren (Drag & Drop oder Add Files):

- `StillMindWatchApp.swift` ← ersetzt die auto-generierte App-Datei
- `ContentView.swift`
- `HomeView.swift`
- `BreathingView.swift`
- `WatchSessionManager.swift`
- `StressMonitor.swift`

**Wichtig:** Beim Hinzufügen → Target Membership = `StillMindWatch` (nicht das iPhone-Target)

## Schritt 4: Entitlements setzen

Im Watch Target → **Signing & Capabilities**:
- `+ Capability` → **HealthKit** hinzufügen
- `+ Capability` → **App Groups** → `group.de.stillmind.app`

## Schritt 5: watch-bridge.js einbinden

In `src/app/_layout.jsx` hinzufügen:

```js
import { initWatchBridge } from "@/utils/watch-bridge";

// In useEffect beim App-Start:
initWatchBridge();
```

## Schritt 6: watch-bridge.js kopieren

```
modules/stillmind-watch/src/utils/watch-bridge.js
→ src/utils/watch-bridge.js
```

## Schritt 7: EAS Build

```bash
eas build --platform ios --profile development
```

⚠️ Watch Target geht **nicht** mit Expo Go — zwingend Development Build nötig.

## Schritt 8: Testen

1. iPhone + Apple Watch mit gleichem Apple ID verbunden
2. App auf iPhone installieren
3. Watch App erscheint automatisch in der Watch App auf dem iPhone
4. Manuell installieren oder über "Automatisch installieren"

---

## Dateistruktur nach Setup

```
apps/mobile/
├── src/
│   └── utils/
│       └── watch-bridge.js          ← NEU
├── ios/
│   ├── StillMind/                   ← bestehend
│   └── StillMindWatch/              ← NEU (Watch Target)
│       ├── StillMindWatchApp.swift
│       ├── ContentView.swift
│       ├── HomeView.swift
│       ├── BreathingView.swift
│       ├── WatchSessionManager.swift
│       ├── StressMonitor.swift
│       ├── Info.plist
│       └── StillMindWatch.entitlements
```

---

## Was die Watch macht

| Feature | Details |
|---|---|
| Atemübung | Box Breathing 4-4-4-4, animierter Kreis, Haptics, 60 Sek |
| Stress-Erkennung | HRV < 75% der persönlichen Baseline → Haptic + Hinweis |
| Daten-Sync | WCSession → iPhone → StillMind Statistik |
| Offline | Queued via `transferUserInfo` wenn iPhone nicht erreichbar |
| Baseline | Aufbau über 10+ HRV-Samples (ca. 3-7 Tage) |
