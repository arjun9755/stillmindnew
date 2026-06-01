import SwiftUI
import WatchKit

struct BreathingView: View {
    @EnvironmentObject var session: WatchSessionManager
    @Environment(\.dismiss) private var dismiss

    // Breathing state
    @State private var scale: CGFloat = 0.55
    @State private var phase: BreathPhase = .inhale
    @State private var secondsRemaining: Int = 60
    @State private var isRunning = false
    @State private var isDone = false
    @State private var timer: Timer?
    @State private var breathTimer: Timer?
    @State private var cycleCount: Int = 0

    // Box breathing: 4-4-4-4
    private let inhaleDuration: Double = 4.0
    private let holdDuration: Double = 4.0
    private let exhaleDuration: Double = 4.0
    private let pauseDuration: Double = 4.0

    enum BreathPhase: String {
        case inhale   = "Einatmen"
        case holdIn   = "Halten"
        case exhale   = "Ausatmen"
        case holdOut  = "Pause"
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if isDone {
                doneView
            } else {
                breathingView
            }
        }
        .onAppear { startSession() }
        .onDisappear { cleanup() }
        .navigationBarBackButtonHidden(true)
    }

    // MARK: Breathing View

    private var breathingView: some View {
        VStack(spacing: 6) {

            // Timer
            Text("\(secondsRemaining)s")
                .font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundColor(.gray)

            Spacer()

            // Animated circle
            ZStack {
                // Glow ring
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 0.80, green: 0.73, blue: 0.63).opacity(0.25),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 55
                        )
                    )
                    .frame(width: 110, height: 110)
                    .scaleEffect(scale * 1.15)

                // Main circle
                Circle()
                    .fill(Color(red: 0.80, green: 0.73, blue: 0.63).opacity(0.18))
                    .overlay(
                        Circle()
                            .strokeBorder(
                                Color(red: 0.80, green: 0.73, blue: 0.63).opacity(0.6),
                                lineWidth: 1.5
                            )
                    )
                    .frame(width: 72, height: 72)
                    .scaleEffect(scale)
            }
            .animation(
                .easeInOut(duration: currentPhaseDuration()),
                value: scale
            )

            Spacer()

            // Phase label
            Text(phase.rawValue)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white)
                .animation(.easeInOut(duration: 0.3), value: phase)

            // Stop button
            Button {
                finishSession(completed: false)
            } label: {
                Text("Stopp")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
    }

    // MARK: Done View

    private var doneView: some View {
        VStack(spacing: 10) {
            Text("✓")
                .font(.system(size: 32, weight: .light))
                .foregroundColor(Color(red: 0.80, green: 0.73, blue: 0.63))
            Text("60 Sekunden\nRuhe")
                .font(.system(size: 14, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundColor(.white)
            Text("\(cycleCount) Atemzyklen")
                .font(.system(size: 11))
                .foregroundColor(.gray)
            Button {
                dismiss()
            } label: {
                Text("Fertig")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color(red: 0.05, green: 0.05, blue: 0.05))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color(red: 0.80, green: 0.73, blue: 0.63))
                    .cornerRadius(10)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
    }

    // MARK: Session Logic

    private func startSession() {
        isRunning = true
        secondsRemaining = 60

        // Countdown timer
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if secondsRemaining > 0 {
                secondsRemaining -= 1
            } else {
                finishSession(completed: true)
            }
        }

        // Start breath cycle
        startBreathCycle()
    }

    private func startBreathCycle() {
        phase = .inhale
        scale = 0.95
        haptic(.start)

        DispatchQueue.main.asyncAfter(deadline: .now() + inhaleDuration) {
            guard isRunning else { return }
            phase = .holdIn
            haptic(.click)

            DispatchQueue.main.asyncAfter(deadline: .now() + holdDuration) {
                guard isRunning else { return }
                phase = .exhale
                scale = 0.55
                haptic(.stop)

                DispatchQueue.main.asyncAfter(deadline: .now() + exhaleDuration) {
                    guard isRunning else { return }
                    phase = .holdOut
                    haptic(.click)

                    DispatchQueue.main.asyncAfter(deadline: .now() + pauseDuration) {
                        guard isRunning else { return }
                        cycleCount += 1
                        startBreathCycle()
                    }
                }
            }
        }
    }

    private func currentPhaseDuration() -> Double {
        switch phase {
        case .inhale:   return inhaleDuration
        case .holdIn:   return holdDuration
        case .exhale:   return exhaleDuration
        case .holdOut:  return pauseDuration
        }
    }

    private func haptic(_ type: WKHapticType) {
        WKInterfaceDevice.current().play(type)
    }

    private func finishSession(completed: Bool) {
        isRunning = false
        cleanup()

        let duration = 60 - secondsRemaining
        cycleCount = max(1, cycleCount)

        // Send to iPhone
        session.sendSessionToPhone(
            duration: duration,
            cycles: cycleCount,
            completed: completed,
            source: "watch"
        )

        if completed {
            WKInterfaceDevice.current().play(.success)
            isDone = true
        } else {
            dismiss()
        }
    }

    private func cleanup() {
        isRunning = false
        timer?.invalidate()
        timer = nil
        breathTimer?.invalidate()
        breathTimer = nil
    }
}
