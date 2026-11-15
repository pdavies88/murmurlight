import AppIntents

/// Siri phrases for Murmurlight. Every phrase must include \(.applicationName).
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PlayMixIntent(),
      phrases: [
        "Play a mix in \(.applicationName)",
        "Play \(\.$mix) in \(.applicationName)",
        "Play my \(\.$mix) mix in \(.applicationName)",
      ],
      shortTitle: "Play Mix",
      systemImageName: "slider.horizontal.3"
    )
    AppShortcut(
      intent: WindDownIntent(),
      phrases: [
        "Wind down with \(.applicationName)",
        "Start winding down in \(.applicationName)",
      ],
      shortTitle: "Wind Down",
      systemImageName: "moon.stars"
    )
    AppShortcut(
      intent: StartBreathingIntent(),
      phrases: [
        "Start breathing with \(.applicationName)",
        "Breathe with \(.applicationName)",
      ],
      shortTitle: "Breathe",
      systemImageName: "wind"
    )
  }
}
