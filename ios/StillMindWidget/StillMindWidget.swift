import WidgetKit
import SwiftUI

// ── Data Model ───────────────────────────────────────────────────────────────

struct WidgetData: Codable {
  var streak: Int
  var doneToday: Bool
  var lastSessionDate: String?
  var missedDays: Int
}

func loadWidgetData() -> WidgetData {
  let suiteName = "group.de.stillmind.app"
  guard let defaults = UserDefaults(suiteName: suiteName) else {
    return WidgetData(streak: 0, doneToday: false, lastSessionDate: nil, missedDays: 0)
  }
  let streak     = defaults.integer(forKey: "widget_streak")
  let doneToday  = defaults.bool(forKey: "widget_done_today")
  let lastDate   = defaults.string(forKey: "widget_last_date")
  let missed     = defaults.integer(forKey: "widget_missed_days")
  return WidgetData(streak: streak, doneToday: doneToday, lastSessionDate: lastDate, missedDays: missed)
}

// ── Stone State ───────────────────────────────────────────────────────────────

struct StoneState {
  let emoji: String
  let color: Color
  let glowColor: Color
  let message: String
  let subMessage: String
}

func stoneState(data: WidgetData) -> StoneState {
  if data.doneToday {
    return StoneState(
      emoji: "🪨",
      color: Color(red: 0.80, green: 0.73, blue: 0.54),   // gold
      glowColor: Color(red: 0.80, green: 0.73, blue: 0.54).opacity(0.4),
      message: "Du bist ruhig.",
      subMessage: data.streak > 1 ? "\(data.streak) Tage Streak 🔥" : "Heute geschafft ✓"
    )
  }
  switch data.missedDays {
  case 0:
    return StoneState(
      emoji: "🪨",
      color: Color(red: 0.55, green: 0.55, blue: 0.55),
      glowColor: .clear,
      message: "Heute noch nichts.",
      subMessage: "60 Sekunden reichen."
    )
  case 1:
    return StoneState(
      emoji: "🪨",
      color: Color(red: 0.40, green: 0.40, blue: 0.45),
      glowColor: .clear,
      message: "Dein Streak bröckelt…",
      subMessage: "Rette ihn jetzt."
    )
  case 2:
    return StoneState(
      emoji: "🪨",
      color: Color(red: 0.28, green: 0.30, blue: 0.38),
      glowColor: .clear,
      message: "Du wirst unruhiger.",
      subMessage: "Komm zurück."
    )
  default:
    return StoneState(
      emoji: "🪨",
      color: Color(red: 0.14, green: 0.14, blue: 0.16),
      glowColor: .clear,
      message: "Alles auf Anfang?",
      subMessage: "Starte neu – jetzt."
    )
  }
}

// ── Timeline ──────────────────────────────────────────────────────────────────

struct StillMindEntry: TimelineEntry {
  let date: Date
  let data: WidgetData
}

struct StillMindProvider: TimelineProvider {
  func placeholder(in context: Context) -> StillMindEntry {
    StillMindEntry(date: Date(), data: WidgetData(streak: 7, doneToday: true, lastSessionDate: nil, missedDays: 0))
  }

  func getSnapshot(in context: Context, completion: @escaping (StillMindEntry) -> Void) {
    completion(StillMindEntry(date: Date(), data: loadWidgetData()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StillMindEntry>) -> Void) {
    let data = loadWidgetData()
    let entry = StillMindEntry(date: Date(), data: data)
    // Refresh every hour
    let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
    let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
    completion(timeline)
  }
}

// ── Small Widget View ─────────────────────────────────────────────────────────

struct StillMindWidgetSmall: View {
  let entry: StillMindEntry
  let state: StoneState

  var body: some View {
    ZStack {
      Color(red: 0.043, green: 0.043, blue: 0.047)

      VStack(spacing: 6) {
        // Stone with glow
        ZStack {
          if entry.data.doneToday {
            Circle()
              .fill(state.glowColor)
              .frame(width: 52, height: 52)
              .blur(radius: 8)
          }
          Text(state.emoji)
            .font(.system(size: 36))
            .saturation(entry.data.doneToday ? 1.0 : entry.data.missedDays > 2 ? 0.1 : 0.5)
            .brightness(entry.data.doneToday ? 0.0 : -Double(min(entry.data.missedDays, 3)) * 0.08)
        }
        .frame(width: 52, height: 52)

        Text(state.message)
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(entry.data.doneToday ? state.color : .white.opacity(0.75))
          .multilineTextAlignment(.center)
          .lineLimit(2)

        Text(state.subMessage)
          .font(.system(size: 9, weight: .regular))
          .foregroundColor(.white.opacity(0.45))
          .multilineTextAlignment(.center)
          .lineLimit(1)
      }
      .padding(12)
    }
    .containerBackground(Color(red: 0.043, green: 0.043, blue: 0.047), for: .widget)
    .widgetURL(URL(string: "stillmind://session"))
  }
}

// ── Medium Widget View ────────────────────────────────────────────────────────

struct StillMindWidgetMedium: View {
  let entry: StillMindEntry
  let state: StoneState

  var body: some View {
    ZStack {
      Color(red: 0.043, green: 0.043, blue: 0.047)

      HStack(spacing: 16) {
        // Left: Stone
        ZStack {
          if entry.data.doneToday {
            Circle()
              .fill(state.glowColor)
              .frame(width: 70, height: 70)
              .blur(radius: 12)
          }
          Text(state.emoji)
            .font(.system(size: 50))
            .saturation(entry.data.doneToday ? 1.0 : entry.data.missedDays > 2 ? 0.05 : 0.4)
            .brightness(entry.data.doneToday ? 0.0 : -Double(min(entry.data.missedDays, 3)) * 0.08)
        }
        .frame(width: 70, height: 70)

        // Right: Text
        VStack(alignment: .leading, spacing: 6) {
          // Streak badge
          if entry.data.streak > 0 {
            HStack(spacing: 4) {
              Text(entry.data.doneToday ? "🔥" : "❄️")
                .font(.system(size: 10))
              Text("\(entry.data.streak) Tage")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(entry.data.doneToday ? state.color : .white.opacity(0.35))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
              RoundedRectangle(cornerRadius: 6)
                .fill(entry.data.doneToday ? state.color.opacity(0.15) : Color.white.opacity(0.06))
            )
          }

          Text(state.message)
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(entry.data.doneToday ? state.color : .white.opacity(0.90))
            .lineLimit(2)

          Text(state.subMessage)
            .font(.system(size: 11, weight: .regular))
            .foregroundColor(.white.opacity(0.45))
            .lineLimit(1)

          if !entry.data.doneToday {
            Text("Jetzt starten →")
              .font(.system(size: 11, weight: .semibold))
              .foregroundColor(state.color)
              .padding(.top, 2)
          }
        }

        Spacer()
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
    }
    .containerBackground(Color(red: 0.043, green: 0.043, blue: 0.047), for: .widget)
    .widgetURL(URL(string: "stillmind://session"))
  }
}

// ── Widget Entry View (routing) ───────────────────────────────────────────────

struct StillMindWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: StillMindEntry

  var body: some View {
    let s = stoneState(data: entry.data)
    switch family {
    case .systemSmall:
      StillMindWidgetSmall(entry: entry, state: s)
    case .systemMedium:
      StillMindWidgetMedium(entry: entry, state: s)
    default:
      StillMindWidgetSmall(entry: entry, state: s)
    }
  }
}

// ── Widget Definition ─────────────────────────────────────────────────────────

@main
struct StillMindWidget: Widget {
  let kind: String = "StillMindWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StillMindProvider()) { entry in
      StillMindWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("StillMind")
    .description("Dein täglicher Ruhestein.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
