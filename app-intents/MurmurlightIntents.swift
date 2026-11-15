import AppIntents
internal import ExpoAppIntents

/// Opens Murmurlight and plays a saved or ready-made mix, with the sleep timer the user last chose.
struct PlayMixIntent: AppIntent {
  static let title: LocalizedStringResource = "Play Mix"
  static let description = IntentDescription("Plays one of your saved mixes or a ready-made mix.")
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Mix", requestValueDialog: "Which mix would you like?")
  var mix: MixEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Play \(\.$mix)")
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "playMix", params: ["mixId": .string(mix.id)])
    return .result()
  }
}

/// Opens the Breathe tab and starts the breathing pacer.
struct StartBreathingIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Breathing"
  static let description = IntentDescription("Opens the breathing pacer and starts it.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "startBreathing", params: [:])
    return .result()
  }
}

/// Starts the wind-down routine: breathing, a sleep meditation, then the mix with the sleep timer.
struct WindDownIntent: AppIntent {
  static let title: LocalizedStringResource = "Wind Down"
  static let description = IntentDescription("Starts breathing, a sleep meditation, then your mix.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "windDown", params: [:])
    return .result()
  }
}
