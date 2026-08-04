//------------------------------------------------------------------------------
import type { EventHubConsumerClient, EventPosition, Subscription } from "@azure/event-hubs";

//------------------------------------------------------------------------------
import type { EventSink, Transport } from "../Transport";

/**
 * Minimal structural view of the `@azure/event-hubs` module, avoiding a hard type dependency on
 * its dual (ESM/CJS) type declarations.
 *
 * @internal
 */
type EventHubsModule = {
    EventHubConsumerClient: typeof EventHubConsumerClient;
    latestEventPosition: EventPosition;
};

/**
 * Configuration of an {@link AzureEventHubTransport}.
 *
 * @inline
 * @category Data
 */
export type AzureEventHubTransportConfig = {
    /**
     * Azure Event Hubs connection string. Publishers that expose an Event Hubs-compatible
     * endpoint (e.g. a Microsoft Fabric Eventstream "custom endpoint") provide one too; it
     * usually embeds an `EntityPath=` segment, e.g.:
     *   Endpoint=sb://xxxx.servicebus.windows.net/;SharedAccessKeyName=key_xxxx;SharedAccessKey=xxxx;EntityPath=xxxx
     */
    connection_string: string;

    /**
     * Consumer group to read with. Defaults to the Event Hubs default consumer group (`"$Default"`).
     */
    consumer_group?: string;

    /**
     * Event hub (entity) name. Only needed when the connection string does NOT embed `EntityPath=`.
     */
    event_hub_name?: string;
};

/**
 * Transport that subscribes to an Azure Event Hub, under the `"azure-event-hub"` kind.
 *
 * Any publisher speaking the Event Hubs protocol works, including Microsoft Fabric "Real-Time
 * Intelligence" Eventstreams via their Event Hubs-compatible custom endpoint.
 *
 * **Channel caveat.** Event Hubs has no per-message routing key, so events are emitted on their
 * partition id — a load-balancing artifact, not a topic: the same logical device can land on
 * different partitions, and the assignment can change. Never write a mapping that selects on
 * `channel` against this transport; select on the payload with `when` instead. The partition id,
 * offset and sequence number are all available in the event's `metadata` for diagnostics.
 *
 * Requires the optional dependency `@azure/event-hubs` (loaded lazily on
 * {@link AzureEventHubTransport.start}).
 *
 * This transport reads from the latest position and does NOT checkpoint. A production deployment
 * that must not miss events across restarts should extend it with a `CheckpointStore` (e.g.
 * `@azure/eventhubs-checkpointstore-blob`) and start from the stored offsets — the
 * `sequence_number` / `offset` carried in each event's metadata are what such a store records.
 *
 * @category Data
 */
export class AzureEventHubTransport implements Transport {
    /**
     * The transport configuration.
     */
    readonly #config: AzureEventHubTransportConfig;

    /**
     * The sink to push events into.
     */
    readonly #sink: EventSink;

    /**
     * The Event Hub client instance, or null if not connected.
     */
    #client: EventHubConsumerClient | null = null;

    /**
     * The subscription to the Event Hub, or null if not subscribed.
     */
    #subscription: Subscription | null = null;

    /**
     *
     */
    constructor(config: AzureEventHubTransportConfig, sink: EventSink) {
        this.#config = config;
        this.#sink = sink;
    }

    /**
     * Connect to the event hub and start receiving events.
     */
    async start(): Promise<void> {
        const connection_string = this.#config.connection_string;
        if (!connection_string) {
            throw new Error("Event Hub connection_string is required in transport config");
        }

        let event_hubs: EventHubsModule;
        try {
            event_hubs = (await import("@azure/event-hubs")) as unknown as EventHubsModule;
        } catch {
            throw new Error(
                'The Azure Event Hub transport requires the optional dependency "@azure/event-hubs". ' +
                    "Install it with `npm install @azure/event-hubs`.",
            );
        }

        const consumer_group =
            this.#config.consumer_group || event_hubs.EventHubConsumerClient.defaultConsumerGroupName;

        // Most connection strings embed `EntityPath=`, so the 2-arg form is the common case. Only
        // when a separate event_hub_name is supplied (string lacks EntityPath) do we fall back to
        // the 3-arg form.
        const has_entity_path = /;EntityPath=/i.test(connection_string);
        if (this.#config.event_hub_name && !has_entity_path) {
            this.#client = new event_hubs.EventHubConsumerClient(
                consumer_group,
                connection_string,
                this.#config.event_hub_name,
            );
        } else {
            this.#client = new event_hubs.EventHubConsumerClient(consumer_group, connection_string);
        }

        const endpoint_for_log = connection_string.replace(/SharedAccessKey=[^;]+/i, "SharedAccessKey=<redacted>");
        console.log(`[azure-event-hub-transport] Subscribing to Event Hub (${endpoint_for_log})...`);

        this.#subscription = this.#client.subscribe(
            {
                processEvents: async (events, context) => {
                    for (const event of events) {
                        await this.#handleEvent(context.partitionId, event);
                    }
                },
                processError: async (error, context) => {
                    console.error(`[azure-event-hub-transport] Error on partition ${context.partitionId}:`, error);
                },
            },
            // Read only events that arrive after we connect.
            { startPosition: event_hubs.latestEventPosition },
        );
    }

    /**
     * Stop receiving events and close the connection.
     */
    async stop(): Promise<void> {
        try {
            await this.#subscription?.close();
        } finally {
            this.#subscription = null;
            await this.#client?.close();
            this.#client = null;
        }
    }

    /**
     * Push an event received from the Event Hub into the sink, on its partition id, carrying the
     * broker's own timestamp and position in its metadata.
     *
     * @param partition_id The partition id the event was received from.
     * @param received The received event, whose body is already deserialized by the Event Hubs SDK.
     */
    async #handleEvent(
        partition_id: string,
        received: { body: unknown; enqueuedTimeUtc?: Date; offset?: string | number; sequenceNumber?: number },
    ): Promise<void> {
        // Event Hubs delivers the event body already deserialized (JSON → object). Guard against
        // non-object bodies (e.g. raw strings) so the pipeline gets a stable shape.
        if (received.body === null || typeof received.body !== "object") {
            console.warn(`[azure-event-hub-transport] Skipping non-object event body on partition ${partition_id}`);
            return;
        }

        try {
            await this.#sink.ingest({
                // A partition id, NOT a topic — see the class doc. Mappings select on the payload.
                channel: partition_id,
                payload: received.body,
                received_at: new Date(),
                ...(received.enqueuedTimeUtc ? { source_timestamp: received.enqueuedTimeUtc } : {}),
                metadata: {
                    transport: "azure-event-hub",
                    partition_id,
                    offset: received.offset,
                    sequence_number: received.sequenceNumber,
                },
            });
        } catch (error) {
            console.error(`[azure-event-hub-transport] Sink failed:`, error);
        }
    }
}
