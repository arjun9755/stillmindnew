import Foundation
import HealthKit
import WatchKit
import Combine

class StressMonitor: NSObject, ObservableObject {

    static let shared = StressMonitor()

    @Published var stressDetected = false
    @Published var currentHRV: Double = 0
    @Published var currentHeartRate: Double = 0
    @Published var baselineHRV: Double = 0
    @Published var hasBaseline = false

    private let healthStore = HKHealthStore()
    private var observerQuery: HKObserverQuery?
    private var lastStressAlert: Date?

    // Minimum 45 min between alerts
    private let minAlertInterval: TimeInterval = 45 * 60

    // Samples needed before baseline is valid
    private let baselineSamplesNeeded = 10

    private override init() {
        super.init()
        requestPermissions()
    }

    // MARK: Permissions

    func requestPermissions() {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let types: Set<HKObjectType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
            HKQuantityType.quantityType(forIdentifier: .heartRate)!
        ]

        healthStore.requestAuthorization(toShare: nil, read: types) { [weak self] success, _ in
            if success {
                DispatchQueue.main.async {
                    self?.startMonitoring()
                }
            }
        }
    }

    // MARK: Start Monitoring

    func startMonitoring() {
        let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!

        observerQuery = HKObserverQuery(sampleType: hrvType, predicate: nil) { [weak self] _, _, error in
            guard error == nil else { return }
            self?.fetchLatestHRV()
        }

        if let query = observerQuery {
            healthStore.execute(query)
            healthStore.enableBackgroundDelivery(for: hrvType, frequency: .immediate) { _, _ in }
        }

        // Also fetch immediately
        fetchLatestHRV()
        fetchLatestHeartRate()
    }

    // MARK: Fetch HRV

    private func fetchLatestHRV() {
        let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: hrvType,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sort]
        ) { [weak self] _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { return }
            let hrv = sample.quantity.doubleValue(for: HKUnit.secondUnit(with: .milli))
            DispatchQueue.main.async {
                self?.processHRV(hrv)
            }
        }
        healthStore.execute(query)
    }

    private func fetchLatestHeartRate() {
        let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: hrType,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sort]
        ) { [weak self] _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { return }
            let hr = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
            DispatchQueue.main.async {
                self?.currentHeartRate = hr
            }
        }
        healthStore.execute(query)
    }

    // MARK: Process HRV + Baseline

    private func processHRV(_ hrv: Double) {
        currentHRV = hrv
        updateBaseline(hrv)

        guard hasBaseline else { return }

        // Stress = HRV drops >25% below personal baseline
        let stressThreshold = baselineHRV * 0.75
        let isStressed = hrv < stressThreshold

        if isStressed && canAlert() {
            triggerStressAlert()
        } else if !isStressed && stressDetected {
            DispatchQueue.main.async {
                self.stressDetected = false
            }
        }
    }

    private func updateBaseline(_ hrv: Double) {
        var samples = UserDefaults.standard.array(forKey: "hrv_baseline_samples") as? [Double] ?? []
        samples.append(hrv)

        // Keep last 50 samples
        if samples.count > 50 { samples = Array(samples.suffix(50)) }
        UserDefaults.standard.set(samples, forKey: "hrv_baseline_samples")

        if samples.count >= baselineSamplesNeeded {
            // Baseline = trimmed mean (remove top/bottom 10%)
            let sorted = samples.sorted()
            let trimCount = max(1, sorted.count / 10)
            let trimmed = Array(sorted.dropFirst(trimCount).dropLast(trimCount))
            baselineHRV = trimmed.reduce(0, +) / Double(trimmed.count)
            hasBaseline = true
        }
    }

    private func canAlert() -> Bool {
        guard let last = lastStressAlert else { return true }
        return Date().timeIntervalSince(last) > minAlertInterval
    }

    private func triggerStressAlert() {
        lastStressAlert = Date()
        stressDetected = true

        // Haptic notification
        WKInterfaceDevice.current().play(.notification)

        // Send to iPhone
        WatchSessionManager.shared.sendStressEventToPhone(
            hrv: currentHRV,
            heartRate: currentHeartRate
        )
    }

    func dismissStress() {
        stressDetected = false
    }
}
