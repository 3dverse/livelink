//------------------------------------------------------------------------------
import type { IngestEvent } from "./IngestEvent";

/**
 * Anything events can be pushed into: an {@link IngestionPipeline}, a {@link SceneIngestion}, a
 * test double, a tee forwarding to several sinks.
 *
 * A {@link Transport} produces whole {@link IngestEvent}s rather than `(channel, payload)` pairs, so
 * what the source knows about an event — when it was actually produced, its offset, its QoS — has
 * somewhere to go instead of being dropped at the boundary.
 *
 * @category Data
 */
export interface EventSink {
    /**
     * Submit one event. Implementations must not throw: a failure to handle one event must not take
     * the transport down.
     */
    ingest(event: IngestEvent): void | Promise<void>;
}

/**
 * A data source feeding an {@link EventSink}.
 *
 * Transports are use-case agnostic: they know how to read from or subscribe to a source and forward
 * each decoded event; they never interpret the payload. Implement one to plug in a protocol the SDK
 * does not bundle (OPC-UA, a WebSocket feed, a serial port) — construct it with the sink, then
 * register the kind on the {@link defaultTransportRegistry} or pass a factory straight to a
 * {@link SceneIngestion}.
 *
 * @category Data
 */
export interface Transport {
    /**
     * Connect to the source and start forwarding events to the sink. Resolves once the source is
     * live; rejects if it cannot be established.
     */
    start(): Promise<void>;

    /**
     * Stop forwarding events and release the connection. Must be safe to call when never started.
     */
    stop(): Promise<void>;
}
