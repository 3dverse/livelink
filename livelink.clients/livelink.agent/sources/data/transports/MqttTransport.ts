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
 * MQTT 5 DISCONNECT reason code for "Session taken over": another client connected with the same
 * client id, and the broker gave it the session (MQTT 5.0 §3.14.2.1).
 */
const SESSION_TAKEN_OVER = 0x8e;

/**
 * How many closes-without-error inside {@link SILENT_CLOSE_WINDOW_MS} are read as a session
 * takeover on MQTT 3.1.1, which has no packet to say so. Three: one is a network blip, two can be
 * a broker restart, three with the client reconnecting in between is another client on the same id.
 */
const SILENT_CLOSE_BURST = 3;

/**
 * The window over which silent closes are counted, in milliseconds.
 */
const SILENT_CLOSE_WINDOW_MS = 30_000;

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
     * Whether an `error` was reported since the last successful connect. A `close` that no error
     * preceded is the broker — or the network — closing the socket, which is worth saying: the
     * `mqtt` module reports every teardown it initiates itself (keepalive or connack timeout) as an
     * error first, so a silent close never comes from this side.
     */
    #errored_since_connect = false;

    /**
     * How many reconnects the client has attempted since `start()`, so a reconnect loop can be
     * counted from the log.
     */
    #reconnect_count = 0;

    /**
     * When the broker closed the socket without any error having been reported, most recent last,
     * pruned to {@link SILENT_CLOSE_WINDOW_MS}. Several of these in a short window is the MQTT
     * 3.1.1 face of a session takeover — another client connecting with this one's `clientId` —
     * which is the one thing a broker enforces that the module cannot check up front.
     */
    #silent_closes: Array<number> = [];

    /**
     * Whether the takeover warning has been printed since `start()`; it is printed once.
     */
    #takeover_warned = false;

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

        // A copy, never the config's own object: `mqtt` keeps the object it is given as the
        // client's live options and writes the `clientId` it generates into it. Handed through as
        // is, the config would come back carrying this client's id, and anything else connecting
        // from the same config — a second transport, a caller's own client — would connect *as*
        // this client and take its session over.
        const connect_options = { ...options };
        this.#client = url ? connect(url, connect_options) : connect(connect_options);
        if (url) {
            console.log(
                `[mqtt-transport] Connecting to MQTT broker at ${url.replace(/\/\/([^@]+)@/, "//<credentials>@")}...`,
            );
        } else {
            console.log("[mqtt-transport] Connecting to MQTT broker via options...");
        }

        this.#errored_since_connect = false;
        this.#reconnect_count = 0;
        this.#silent_closes = [];
        this.#takeover_warned = false;

        this.#client.on("connect", () => {
            console.log(`[mqtt-transport] Connected as ${this.#clientId()}`);
            this.#errored_since_connect = false;
            for (const topic of this.#config.topics ?? []) {
                this.#client!.subscribe(topic);
            }
        });
        this.#client.on("message", (topic: string, payload: Buffer, packet?: { qos?: number; retain?: boolean }) => {
            void this.#handleMessage(topic, payload.toString(), packet);
        });

        this.#client.on("error", err => {
            this.#errored_since_connect = true;
            console.error("========================================");
            console.error("[mqtt-transport] >>> ERROR");
            console.error("========================================");
            console.error("Message:", err.message);
            console.error("Cause:", err.cause);
            console.error("Name:", err.name);
            console.error("Stack:");
            console.error(err.stack);
        });

        // An MQTT 5 broker says why it is dropping a client in a DISCONNECT packet; on MQTT 3.1.1
        // it can only close the socket, and this never fires.
        this.#client.on("disconnect", packet => {
            const reason = packet.properties?.reasonString;
            console.error("========================================");
            console.error("[mqtt-transport] >>> DISCONNECTED BY THE BROKER");
            console.error("========================================");
            console.error("Reason code:", packet.reasonCode ?? "(none)");
            console.error("Reason:", reason ?? "(none given)");
            if (packet.reasonCode === SESSION_TAKEN_OVER) {
                console.error(
                    `Session taken over: another client connected with this client's id "${this.#clientId()}".`,
                );
            }
        });

        this.#client.on("close", () => {
            if (this.#errored_since_connect) {
                console.log("[mqtt-transport] >>> CONNECTION CLOSED");
                return;
            }
            console.log(
                "[mqtt-transport] >>> CONNECTION CLOSED (no error was reported: the broker closed the socket, or the network did)",
            );
            this.#noteSilentClose();
        });

        this.#client.on("offline", () => {
            console.log("[mqtt-transport] >>> CLIENT OFFLINE");
        });

        this.#client.on("end", () => {
            console.log("[mqtt-transport] >>> CLIENT END");
        });

        this.#client.on("reconnect", () => {
            this.#reconnect_count++;
            console.log(`[mqtt-transport] >>> RECONNECTING (attempt ${this.#reconnect_count} since start)`);
        });
    }

    /**
     * The id this client presents to the broker — the one `mqtt` generated when the config carried
     * none — or `"?"` before there is a client.
     */
    #clientId(): string {
        const client_id = (this.#client?.options as { clientId?: unknown } | undefined)?.clientId;
        return typeof client_id === "string" ? client_id : "?";
    }

    /**
     * Records one silent close and, once, warns when they come in a burst. A broker that takes a
     * session over says so in a DISCONNECT packet on MQTT 5, but on 3.1.1 it can only drop the
     * socket, and a client dropped without error several times in a row while it keeps
     * reconnecting is that, far more often than a flaky network.
     */
    #noteSilentClose(): void {
        const now = Date.now();
        this.#silent_closes.push(now);
        this.#silent_closes = this.#silent_closes.filter(at => now - at <= SILENT_CLOSE_WINDOW_MS);
        if (this.#takeover_warned || this.#silent_closes.length < SILENT_CLOSE_BURST) {
            return;
        }
        this.#takeover_warned = true;
        const span_s = Math.round((now - this.#silent_closes[0]) / 1000);
        console.warn(
            `[mqtt-transport] >>> closed by the broker ${this.#silent_closes.length} times in ${span_s} s with no error ` +
                `reported. Most likely another client is connecting with the same clientId "${this.#clientId()}" ` +
                `and the broker is handing the session back and forth (session takeover).`,
        );
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
