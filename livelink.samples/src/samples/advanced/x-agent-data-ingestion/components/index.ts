//------------------------------------------------------------------------------
// The console chrome shared by the data-ingestion samples: the source listing, the live event
// trace and the pipeline counters. The samples keep their mappings and their transport wiring —
// what there is to read — inline.
//------------------------------------------------------------------------------
export { SourceTextPanel } from "./SourceTextPanel";
export { EventTracePanel, useEventTrace, type TraceRow } from "./EventTracePanel";
export { IngestionStatsPanel } from "./IngestionStatsPanel";
export { SpeedSelect } from "./SpeedSelect";
