import SwiftUI

struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager
    @StateObject private var stressMonitor = StressMonitor.shared

    var body: some View {
        NavigationStack {
            HomeView()
                .environmentObject(session)
                .environmentObject(stressMonitor)
        }
    }
}
