/**
 * A single raw event flowing from a {@link Transport} into a {@link EventSink} (typically a
 * {@link SceneIngestion}, or an {@link IngestionPipeline} you feed directly).
 *
 * @category Data
 */
export type IngestEvent = {
    /**
     * The channel the event arrived on.
     *
     * Its meaning is **transport-defined**, and only the MQTT transport gives it routing value:
     *
     * | Transport   | `channel` is                          | Usable in a mapping's `channel` pattern |
     * | ----------- | ------------------------------------- | --------------------------------------- |
     * | `mqtt`      | the topic                             | yes                                     |
     * | `file`      | the recorded topic, else `"file"`     | yes, when the playback carries channels |
     * | `event-hub` | the partition id (**not semantic**)   | no — it is a load-balancing artifact    |
     *
     * A mapping that must route on an Event Hub stream selects on the payload with `when` instead.
     */
    channel: string;

    /**
     * The decoded message payload. Transports deliver JSON-decoded values; the shape is defined by
     * the data source.
     */
    payload: unknown;

    /**
     * When the event was received by the transport — this SDK's own clock, always present on events
     * produced by a transport.
     */
    received_at?: Date;

    /**
     * When the event was produced **at the source**, as reported by the source itself: the message's
     * own timestamp field for file playback, `enqueuedTimeUtc` for Event Hubs. Absent when the
     * source carries no usable time.
     *
     * Prefer it over {@link received_at} for staleness checks and out-of-order detection: the
     * arrival clock says when this process saw the event, not when the machine produced it.
     */
    source_timestamp?: Date;

    /**
     * Transport-specific envelope fields that have no place in the generic shape — the MQTT `retain`
     * flag and QoS, an Event Hubs `offset` / `sequence_number` / `partition_id`, ... Populated by the
     * transport, opaque to the pipeline, and readable from a mapping's `when` /
     * `updates`.
     */
    metadata?: Record<string, unknown>;
};
