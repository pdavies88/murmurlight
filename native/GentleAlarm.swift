internal import ExpoModulesCore
import Foundation
#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import SwiftUI

@available(iOS 26.0, *)
nonisolated struct GentleWakeMetadata: AlarmMetadata {
  init() {}
}
#endif

/// The gentle wake alarm, through AlarmKit on iOS 26 and later. An AlarmKit alarm rings even when
/// the phone is on silent or in a Focus, and shows the system alarm screen. Murmurlight keeps at
/// most one: a daily alarm that plays the soft "gentle-wake" sound bundled with the app.
final class GentleAlarm: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("GentleAlarm")

    Function("isAvailable") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return true }
      #endif
      return false
    }

    /// True when the app may set alarms.
    Function("isAuthorized") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return AlarmManager.shared.authorizationState == .authorized }
      #endif
      return false
    }

    /// Asks for alarm permission the first time. Returns true when alarms are allowed.
    AsyncFunction("requestAccess") { () async throws -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let manager = AlarmManager.shared
        if manager.authorizationState == .authorized { return true }
        return try await manager.requestAuthorization() == .authorized
      }
      #endif
      return false
    }

    /// Replaces any alarm with a daily one at this hour and minute.
    AsyncFunction("setDaily") { (hour: Int, minute: Int) async throws -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let manager = AlarmManager.shared
        guard manager.authorizationState == .authorized else { return false }
        for alarm in try manager.alarms { try? manager.cancel(id: alarm.id) }
        let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "sun.max.fill")
        let alert = AlarmPresentation.Alert(title: "Good morning", stopButton: stop)
        let attributes = AlarmAttributes<GentleWakeMetadata>(
          presentation: AlarmPresentation(alert: alert),
          tintColor: Color(red: 0.42, green: 0.36, blue: 0.88)
        )
        let everyDay: [Locale.Weekday] = [.sunday, .monday, .tuesday, .wednesday, .thursday, .friday, .saturday]
        let schedule = Alarm.Schedule.relative(
          Alarm.Schedule.Relative(time: .init(hour: hour, minute: minute), repeats: .weekly(everyDay))
        )
        // The sound plays once and lasts under 30 seconds. It is bundled through the
        // expo-notifications "sounds" option, so it is in the app bundle.
        let configuration = AlarmManager.AlarmConfiguration(
          countdownDuration: nil,
          schedule: schedule,
          attributes: attributes,
          sound: ActivityKit.AlertConfiguration.AlertSound.named("gentle-wake.wav")
        )
        _ = try await manager.schedule(id: UUID(), configuration: configuration)
        return true
      }
      #endif
      return false
    }

    /// Removes the alarm.
    AsyncFunction("cancel") { () throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let manager = AlarmManager.shared
        for alarm in try manager.alarms { try? manager.cancel(id: alarm.id) }
      }
      #endif
    }
  }
}
