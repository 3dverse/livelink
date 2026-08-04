export * from "./IngestEvent";
export * from "./Transport";
export * from "./transports/TransportRegistry";
export * from "./transports/PlaybackTransport";
export * from "./transports/MqttTransport";
export * from "./transports/AzureEventHubTransport";
export * from "./transports/OpcUaTransport";

export * from "./EventMapping";
export * from "./IngestionPipeline";
export * from "./SceneIngestion";
export * from "./SceneIngestionEvents";

// The modules below are re-exported by name rather than wholesale: they hold the machinery of the
// data layer (validator, resolvers, applier, stats counters) next to the few configuration types
// the mapping surface refers to. Only the latter are API — a mapping cannot
// plug in its own resolver, and nothing a consumer writes has a use for a `ComponentPatchApplier`.
// The machinery stays importable by deep path; it is simply not advertised, nor documented.
export type { JsonSchema } from "./SchemaValidator";
export type { EntityMap, MappedEntity } from "./resolvers/ExistingEntityResolver";
export type { EntityTemplate } from "./resolvers/SpawningEntityResolver";
export type { IngestionDropReason, IngestionStats, MappingStats } from "./IngestionStats";

// Kept public: it defines this SDK's own channel-pattern semantics, which a mapping's `when`
// predicate may legitimately want to apply itself.
export { matchChannel } from "./util/channel";
