//------------------------------------------------------------------------------
import type { IClientOptions, MqttClient } from "mqtt";

//------------------------------------------------------------------------------
import type { EventSink, Transport } from "../Transport";

/**
 * The shape of the lazily imported `mqtt` module, which differs between the CJS build Node
 * resolves and the ESM build a browser bundler resolves — see {@link MqttTransport.start}.
 */
type MqttModule = {
    connect?: typeof import("mqtt").connect;
    default?: { connect: typeof import("mqtt").connect };
};

/**
 * Configuration of an {@link MqttTransport}.
 *
 * @inline
 * @category Data
 */
export type MqttTransportConfig = {
    /**
     * URL of the MQTT broker, e.g. `mqtt://user:pass@broker.example.com:1883`.
     *
     * Optional when `options` fully describes the connection (e.g. via its `host`/`port` or
     * `servers` fields), matching the underlying `mqtt` module's own `connect(options)` overload.
     */
    broker_url?: string;

    /**
     * MQTT client options passed through to the underlying `mqtt` module's `connect()`.
     */
    options?: IClientOptions;

    /**
     * Topics to subscribe to. MQTT wildcards (`+`, `#`) are supported.
     */
    topics?: Array<string>;
};

/**
 * Transport that subscribes to an MQTT broker and forwards each JSON message as an event **on its
 * topic** — the one bundled transport whose channel is a genuine routing key, so mappings can
 * select on it with a `channel` pattern.
 *
 * The QoS and retain flag travel along in the event's `metadata`.
 *
 * Requires the optional dependency `mqtt` (loaded lazily on {@link MqttTransport.start}).
 *
 * @category Data
 */
export class MqttTransport implements Transport {
    /**
     * The transport configuration.
     */
    readonly #config: MqttTransportConfig;

    /**
     * The sink to push events into.
     */
    readonly #sink: EventSink;

    /**
     * The MQTT client instance, or null if not connected.
     */
    #client: MqttClient | null = null;

    /**
     *
     */
    constructor(config: MqttTransportConfig, sink: EventSink) {
        this.#config = config;
        this.#sink = sink;
    }

    /**
     * Connect to the broker and subscribe to the configured topics.
     */
    async start(): Promise<void> {
        const url = this.#config.broker_url;
        const options = this.#config.options;
        if (!url && !options) {
            throw new Error("MQTT transport config requires broker_url and/or options");
        }

        let mqtt_module: MqttModule;
        try {
            mqtt_module = (await import("mqtt")) as unknown as MqttModule;
        } catch {
            throw new Error(
                'The MQTT transport requires the optional dependency "mqtt". Install it with `npm install mqtt`.',
            );
        }

        // `mqtt` resolves to a different build per runtime: Node gets the CJS one, whose named
        // exports interop exposes `connect` directly, while a bundler targeting the browser gets
        // `dist/mqtt.esm.js`, whose *only* export is the default one. The package types declare
        // both, so reading `connect` off the namespace type-checks and is undefined in a page.
        const connect = mqtt_module.connect ?? mqtt_module.default?.connect;
        if (!connect) {
            throw new Error('The optional dependency "mqtt" resolved to a module without a `connect` export.');
        }

        this.#client = url ? connect(url, options) : connect(options!);
        if (url) {
            console.log(
                `[mqtt-transport] Connecting to MQTT broker at ${url.replace(/\/\/([^@]+)@/, "//<credentials>@")}...`,
            );
        } else {
            console.log("[mqtt-transport] Connecting to MQTT broker via options...");
        }

        this.#client.on("connect", () => {
            console.log(`[mqtt-transport] Connected`);
            for (const topic of this.#config.topics ?? []) {
                this.#client!.subscribe(topic);
            }
        });
        this.#client.on("message", (topic: string, payload: Buffer, packet?: { qos?: number; retain?: boolean }) => {
            void this.#handleMessage(topic, payload.toString(), packet);
        });

        this.#client.on("error", err => {
            console.error("========================================");
            console.error("[mqtt-transport] >>> ERROR");
            console.error("========================================");
            console.error("Message:", err.message);
            console.error("Cause:", err.cause);
            console.error("Name:", err.name);
            console.error("Stack:");
            console.error(err.stack);
        });

        this.#client.on("close", () => {
            console.log("[mqtt-transport] >>> CONNECTION CLOSED");
        });

        this.#client.on("offline", () => {
            console.log("[mqtt-transport] >>> CLIENT OFFLINE");
        });

        this.#client.on("end", () => {
            console.log("[mqtt-transport] >>> CLIENT END");
        });

        this.#client.on("reconnect", () => {
            console.log("[mqtt-transport] >>> RECONNECTING");
        });
    }

    /**
     * Disconnect from the broker.
     */
    async stop(): Promise<void> {
        if (this.#client) {
            this.#client.end();
            this.#client = null;
        }
    }

    /**
     * Handle a message received from the broker by parsing it as JSON and pushing it to the sink,
     * on its topic.
     *
     * @param topic The topic the message was received on.
     * @param payload The message payload as a string.
     * @param packet The MQTT packet, whose QoS and retain flag travel in the event's metadata.
     */
    async #handleMessage(topic: string, payload: string, packet?: { qos?: number; retain?: boolean }): Promise<void> {
        let message: unknown;
        try {
            message = JSON.parse(payload);
        } catch {
            console.warn(`[mqtt-transport] Invalid JSON on topic ${topic}`);
            return;
        }

        try {
            await this.#sink.ingest({
                channel: topic,
                payload: message,
                received_at: new Date(),
                metadata: { transport: "mqtt", qos: packet?.qos, retain: packet?.retain },
            });
        } catch (error) {
            console.error(`[mqtt-transport] Sink failed:`, error);
        }
    }
}
