internal import ExpoModulesCore
import HealthKit

/// Writes meditation and breathing sessions to Apple Health as mindful minutes. Murmurlight only
/// writes this one type. It never reads anything from Health.
final class MindfulHealth: Module {
  private let store = HKHealthStore()
  private let mindful = HKCategoryType(.mindfulSession)

  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("MindfulHealth")

    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    /// Shows the Health permission sheet the first time. Returns true when writing is allowed.
    AsyncFunction("requestAccess") { () async throws -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else { return false }
      try await self.store.requestAuthorization(toShare: [self.mindful], read: [])
      return self.store.authorizationStatus(for: self.mindful) == .sharingAuthorized
    }

    /// Saves one session, given its start and end in milliseconds since 1970.
    AsyncFunction("saveSession") { (startMs: Double, endMs: Double) async throws -> Bool in
      guard HKHealthStore.isHealthDataAvailable(),
        self.store.authorizationStatus(for: self.mindful) == .sharingAuthorized,
        endMs > startMs
      else { return false }
      let sample = HKCategorySample(
        type: self.mindful,
        value: HKCategoryValue.notApplicable.rawValue,
        start: Date(timeIntervalSince1970: startMs / 1000),
        end: Date(timeIntervalSince1970: endMs / 1000)
      )
      try await self.store.save(sample)
      return true
    }
  }
}
