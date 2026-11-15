import AppIntents
internal import ExpoAppIntents

/// Finds MixEntity values in the catalog the app publishes from JavaScript: the user's saved mixes
/// and the ready-made mixes. The app republishes it whenever a mix is saved or deleted.
struct MixQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [MixEntity] {
    return try await AppIntentEntityStore.shared.entities(ofKind: "mix", matching: identifiers)
      .map(MixEntity.init(record:))
  }

  func suggestedEntities() async throws -> [MixEntity] {
    return try await AppIntentEntityStore.shared.entities(ofKind: "mix")
      .map(MixEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [MixEntity] {
    return try await suggestedEntities().filter { $0.matches(string) }
  }
}
