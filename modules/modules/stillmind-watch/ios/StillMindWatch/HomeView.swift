import SwiftUI

struct HomeView: View {
    @EnvironmentObject var session: WatchSessionManager
    @EnvironmentObject var stressMonitor: StressMonitor
    @State private var navigateToBreathing = false

    var body: some View {
        VStack(spacing: 8) {

            // Logo / Brand
            Text("StillMind")
                .font(.system(size: 16, weight: .semibold, design: .serif))
                .foregroundColor(Color(red: 0.80, green: 0.73, blue: 0.63))

            Spacer()

            // Stress Indicator
            if stressMonitor.stressDetected {
                VStack(spacing: 6) {
                    Text("🫀")
                        .font(.system(size: 28))
                    Text("Dein Körper braucht\n60 Sekunden")
                        .font(.system(size: 13, weight: .medium))
                        .multilineTextAlignment(.center)
                        .foregroundColor(.white)
                }
            } else {
                VStack(spacing: 6) {
                    Circle()
                        .fill(Color(red: 0.80, green: 0.73, blue: 0.63).opacity(0.15))
                        .frame(width: 44, height: 44)
                        .overlay(
                            Text("🌿")
                                .font(.system(size: 20))
                        )
                    Text("Alles ruhig")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
            }

            Spacer()

            // Start Breathing Button
            NavigationLink(destination: BreathingView()) {
                Text("60 Sek. Ruhe")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(red: 0.05, green: 0.05, blue: 0.05))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color(red: 0.80, green: 0.73, blue: 0.63))
                    .cornerRadius(12)
            }
            .buttonStyle(.plain)

        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .onReceive(stressMonitor.$stressDetected) { detected in
            if detected {
                WKInterfaceDevice.current().play(.notification)
            }
        }
    }
}
