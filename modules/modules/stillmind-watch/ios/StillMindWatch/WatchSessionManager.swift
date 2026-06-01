import Foundation
import WatchConnectivity

class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {

    static let shared = WatchSessionManager()

    @Published var isReachable = false
    @Published var lastMessage: [String: Any] = [:]

    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: Send session data to iPhone

    func sendSessionToPhone(duration: Int, cycles: Int, completed: Bool, source: String) {
        guard WCSession.default.isReachable else {
            // Store locally for later sync
            storeSessionLocally(duration: duration, cycles: cycles, completed: completed)
            return
        }

        let payload: [String: Any] = [
            "type": "breathing_session",
            "duration": duration,
            "cycles": cycles,
            "completed": completed,
            "source": source,
            "timestamp": Date().timeIntervalSince1970,
            "mode": "box"
        ]

        WCSession.default.sendMessage(payload, replyHandler: nil) { error in
            // Fallback: store in transferUserInfo (queued, guaranteed delivery)
            WCSession.default.transferUserInfo(payload)
        }
    }

    func sendStressEventToPhone(hrv: Double, heartRate: Double) {
        let payload: [String: Any] = [
            "type": "stress_event",
            "hrv": hrv,
            "heartRate": heartRate,
            "timestamp": Date().timeIntervalSince1970
        ]

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        } else {
            WCSession.default.transferUserInfo(payload)
        }
    }

    // MARK: Local storage fallback

    private func storeSessionLocally(duration: Int, cycles: Int, completed: Bool) {
        var pending = UserDefaults.standard.array(forKey: "pendingSessions") as? [[String: Any]] ?? []
        pending.append([
            "type": "breathing_session",
            "duration": duration,
            "cycles": cycles,
            "completed": completed,
            "source": "watch",
            "timestamp": Date().timeIntervalSince1970
        ])
        UserDefaults.standard.set(pending, forKey: "pendingSessions")
    }

    private func flushPendingSessions() {
        guard WCSession.default.isReachable else { return }
        let pending = UserDefaults.standard.array(forKey: "pendingSessions") as? [[String: Any]] ?? []
        guard !pending.isEmpty else { return }

        for session in pending {
            WCSession.default.sendMessage(session, replyHandler: nil, errorHandler: nil)
        }
        UserDefaults.standard.removeObject(forKey: "pendingSessions")
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if activationState == .activated {
                self.flushPendingSessions()
            }
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.flushPendingSessions()
            }
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            self.lastMessage = message
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        DispatchQueue.main.async {
            self.lastMessage = userInfo
        }
    }
}
