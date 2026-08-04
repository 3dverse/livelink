//------------------------------------------------------------------------------
import type { EventSink, Transport } from "../Transport";
// `node-opcua-client` is an optional peer this repository does not install; everything the transport
// knows about it is declared there rather than imported from it.
import {
    ATTRIBUTE_ID_VALUE,
    DATA_TYPE_INT64,
    DATA_TYPE_UINT64,
    MESSAGE_SECURITY_MODES,
    SECURITY_POLICIES,
    SECURITY_POLICY_URI_PREFIX,
    STATUS_SEVERITY_UNCERTAIN,
    TIMESTAMPS_TO_RETURN_BOTH,
    USER_TOKEN_TYPE_USER_NAME,
    VARIANT_ARRAY_TYPE_SCALAR,
    type OpcUaClient,
    type OpcUaClientModule,
    type OpcUaDataValue,
    type OpcUaSession,
    type OpcUaSubscription,
    type OpcUaUserIdentity,
    type OpcUaVariant,
} from "./OpcUaClientModule";

/**
 * One OPC UA variable to monitor, and the channel its samples are published on.
 *
 * @category Data
 */
export type OpcUaNodeSpec = {
    /**
     * Identifier of the node to monitor, e.g. `ns=3;s="DB_Line1"."Temperature"` on a Siemens PLC or
     * `ns=2;i=1042` on a server using numeric identifiers.
     */
    node_id: string;

    /**
     * Channel the samples of this node are published on. Defaults to {@link OpcUaNodeSpec.node_id}.
     *
     * Worth setting: channel patterns match over `/`-separated segments, and a raw node id is a
     * single opaque segment full of `;`, `=` and quotes. Aliasing `ns=3;s="DB1"."Temp"` to
     * `plc/line1/temperature` is what lets a mapping select it with `channel: "plc/+/temperature"`.
     */
    channel?: string;

    /**
     * How often the server samples this node, in milliseconds. Overrides
     * {@link OpcUaTransportConfig.sampling_interval} for this node alone — the one knob worth
     * setting per node, a fast counter and a slow temperature rarely deserving the same rate.
     */
    sampling_interval?: number;
};

/**
 * Configuration of an {@link OpcUaTransport}.
 *
 * @inline
 * @category Data
 */
export type OpcUaTransportConfig = {
    /**
     * Endpoint of the OPC UA server, e.g. `opc.tcp://plc.example.com:4840`.
     */
    endpoint_url: string;

    /**
     * Nodes to monitor. A bare string is a node id whose channel is that same node id; use the
     * {@link OpcUaNodeSpec} form to alias it to a readable channel.
     */
    nodes: Array<string | OpcUaNodeSpec>;

    /**
     * How often the server publishes the samples it has collected, in milliseconds. Defaults to
     * `1000`. This is the latency floor of the whole ingestion: sampling faster than this only
     * fills the queue.
     *
     * This is a *request*: the server answers with the interval it will actually publish at, and
     * that is the one that holds. Most servers refuse to go below **50 ms** — node-opcua's own server
     * clamps there, and caps at one minute — so asking for less buys nothing. A request the server
     * revises upward is logged once rather than absorbed silently, since everything downstream of a
     * halved sample rate looks like a bug elsewhere.
     */
    publishing_interval?: number;

    /**
     * How often the server samples the monitored nodes, in milliseconds. Defaults to
     * {@link OpcUaTransportConfig.publishing_interval}, i.e. one sample per publication.
     *
     * Revised by the server the same way the publishing interval is, and logged the same way: a node
     * whose underlying device cannot be read faster comes back with its own minimum, whatever this
     * asks for.
     */
    sampling_interval?: number;

    /**
     * How many samples the server buffers per node between two publications. Defaults to `1`, which
     * keeps only the latest — the right choice for telemetry driving a scene. Raise it to receive
     * every sample of a node sampled faster than it is published.
     */
    queue_size?: number;

    /**
     * Message security to negotiate. Defaults to `"None"`, or to `"SignAndEncrypt"` when a
     * {@link OpcUaTransportConfig.security_policy} other than `"None"` is named.
     */
    security_mode?: "None" | "Sign" | "SignAndEncrypt";

    /**
     * Security policy to negotiate, by short name (`"Basic256Sha256"`,
     * `"Aes128_Sha256_RsaOaep"`, ...) or by full policy URI. Defaults to `"None"`, or to
     * `"Basic256Sha256"` when a {@link OpcUaTransportConfig.security_mode} other than `"None"` is
     * named. The two must agree: either both are `"None"`, or neither is.
     */
    security_policy?: string;

    /**
     * User name to authenticate with. Omitted = connect anonymously.
     */
    username?: string;

    /**
     * Password that goes with {@link OpcUaTransportConfig.username}.
     */
    password?: string;

    /**
     * Application name announced to the server, and carried by the client certificate generated for
     * a secured connection. Defaults to `"livelink-agent"`.
     */
    application_name?: string;

    /**
     * How many times to retry the connection before giving up. Defaults to `3`.
     *
     * Deliberately bounded: sources are started sequentially and awaited, so a transport retrying
     * forever would hang the whole ingestion rather than report. A failed start surfaces on
     * `on-error` and is retried by the next session to bind, which is the loop that actually
     * survives a PLC being down at boot. The same budget governs the automatic reconnection after
     * an established connection drops.
     */
    max_retry?: number;
};

//------------------------------------------------------------------------------
/**
 * Defaults for the subscription's pace.
 */
const DEFAULT_PUBLISHING_INTERVAL = 1_000;
const DEFAULT_QUEUE_SIZE = 1;
const DEFAULT_MAX_RETRY = 3;

/**
 * How much slower than requested a revised interval has to be before it is worth reporting. Revised
 * values come back as floats, and a server rounding a request to its own timer granularity is not
 * what this is here to catch.
 */
const INTERVAL_REVISION_EPSILON_MS = 0.5;

//------------------------------------------------------------------------------
/**
 * Turn a variant into something a component patch can hold: a number, a string, a boolean, a `Date`
 * or an array of those.
 *
 * Two shapes need help. Numeric arrays arrive as typed arrays, which are not what a component
 * expects to be handed. And 64-bit integers arrive as a `[high, low]` pair of 32-bit halves —
 * writing that straight into a component would silently store a two-element array where a Siemens
 * `LInt` was meant, so the halves are recombined here. Beyond 2^53 the result is rounded, which is
 * the price of staying a `number`.
 *
 * Returns `undefined` when the variant carries no value at all — OPC UA has no such value, so the
 * caller can read it as "nothing to publish".
 *
 * @internal
 */
export function decodeOpcUaVariant(variant: OpcUaVariant | null | undefined): unknown {
    const value = variant?.value;
    if (value === undefined || value === null) {
        return undefined;
    }

    if (variant?.dataType === DATA_TYPE_INT64 || variant?.dataType === DATA_TYPE_UINT64) {
        const is_scalar = variant.arrayType === undefined || variant.arrayType === VARIANT_ARRAY_TYPE_SCALAR;
        return is_scalar ? decode64BitInteger(value) : toArray(value).map(decode64BitInteger);
    }

    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        return Array.from(value as unknown as ArrayLike<unknown>);
    }

    return value;
}

/**
 * Recombine the `[high, low]` pair node-opcua uses for a 64-bit integer. `BigInt` bitwise operators
 * work in two's complement, so a negative high half yields the negative `Int64` it encodes.
 */
function decode64BitInteger(value: unknown): unknown {
    if (typeof value === "bigint") {
        return Number(value);
    }
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number") {
        return Number((BigInt(value[0]) << 32n) | BigInt(value[1] >>> 0));
    }
    return value;
}

/**
 * Read a variant's array value as an array, whatever container it came in.
 */
function toArray(value: unknown): Array<unknown> {
    return Array.isArray(value) ? value : Array.from(value as ArrayLike<unknown>);
}

/**
 * Expand the node list into full specs, so the constructor is where a config mistake is reported
 * rather than the first sample that never arrives.
 */
function normalizeNodes(nodes: Array<string | OpcUaNodeSpec> | undefined): Array<OpcUaNodeSpec> {
    if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error("At least one node is required in the OPC UA transport config");
    }
    return nodes.map(node => {
        const spec = typeof node === "string" ? { node_id: node } : node;
        if (!spec?.node_id) {
            throw new Error(`Every OPC UA node needs a node_id, got ${JSON.stringify(node)}`);
        }
        return spec;
    });
}

/**
 * Resolve the security mode and policy to what the client expects, each defaulting from the other:
 * naming a policy means security is wanted, and asking for `Sign` or `SignAndEncrypt` without a
 * policy means the modern default.
 */
function resolveSecurity(config: OpcUaTransportConfig): { mode: number; policy: string } {
    const wants_security = config.security_policy !== undefined && config.security_policy !== "None";
    const mode_name = config.security_mode ?? (wants_security ? "SignAndEncrypt" : "None");
    const policy_name = config.security_policy ?? (mode_name === "None" ? "None" : "Basic256Sha256");

    const mode = MESSAGE_SECURITY_MODES[mode_name];
    if (mode === undefined) {
        throw new Error(
            `Unknown OPC UA security_mode "${mode_name}". Expected one of: ${Object.keys(MESSAGE_SECURITY_MODES).join(", ")}.`,
        );
    }

    // A full policy URI passes through, so a policy published after this SDK can still be named.
    const is_uri = policy_name.startsWith("http");
    if (!is_uri && !SECURITY_POLICIES.includes(policy_name)) {
        throw new Error(
            `Unknown OPC UA security_policy "${policy_name}". Expected one of: ${SECURITY_POLICIES.join(", ")}, or a full policy URI.`,
        );
    }

    if ((mode_name === "None") !== (policy_name === "None")) {
        throw new Error(
            `OPC UA security_mode "${mode_name}" and security_policy "${policy_name}" disagree: either both are "None", or neither is.`,
        );
    }

    return { mode, policy: is_uri ? policy_name : `${SECURITY_POLICY_URI_PREFIX}${policy_name}` };
}

/**
 * Run a teardown step, reporting rather than throwing: a session that already died under us must
 * not stop the socket below it from being closed.
 */
async function closeQuietly(action: () => Promise<void> | undefined): Promise<void> {
    try {
        await action();
    } catch (error) {
        console.warn(`[opcua-transport] Error while closing:`, error);
    }
}

//------------------------------------------------------------------------------
/**
 * Transport that subscribes to variables on an OPC UA server over `opc.tcp://` and forwards each
 * value change as an event **on the node's channel** — the node id, or the readable alias given in
 * its {@link OpcUaNodeSpec}. Like MQTT and unlike Event Hubs, that channel is a genuine routing key
 * a mapping can select on.
 *
 * This is the classic client/server profile, which is what a PLC whose firmware predates PubSub
 * exposes. **If the plant already bridges OPC UA to MQTT** — via OPC UA PubSub over MQTT, Telegraf's
 * `inputs.opcua`, Kepware, Ignition — point the `mqtt` transport at that broker instead: one hop
 * fewer, and no OPC UA client to keep alive next to the scene.
 *
 * Each event's payload is `{ node_id, value, status }` and its `source_timestamp` is the server's
 * own clock. Samples whose status is Bad carry no meaningful value and are dropped, logging once per
 * node rather than at every publication.
 *
 * Requires the optional dependency `node-opcua-client` (loaded lazily on
 * {@link OpcUaTransport.start}). `opc.tcp` is raw TCP, so **this transport is Node.js only** — in a
 * browser the lazy import is what fails, with the same message as a missing install.
 *
 * A secured connection (`security_mode` other than `"None"`) makes node-opcua generate a
 * self-signed client certificate under a `certificates/` folder on first use. The server has to
 * trust it — on a Siemens PLC, that is a manual step in the web interface, and the failure everyone
 * hits first.
 *
 * @category Data
 */
export class OpcUaTransport implements Transport {
    /**
     * The transport configuration.
     */
    readonly #config: OpcUaTransportConfig;

    /**
     * The sink to push events into.
     */
    readonly #sink: EventSink;

    /**
     * The nodes to monitor, expanded from the config's shorthand.
     */
    readonly #nodes: Array<OpcUaNodeSpec>;

    /**
     * The security mode and policy to negotiate, resolved from the config.
     */
    readonly #security: { mode: number; policy: string };

    /**
     * Nodes already reported as unusable, so an unhealthy one logs once instead of at every
     * publication. Cleared for a node as soon as it publishes a usable sample again, so a later
     * outage is reported anew.
     */
    readonly #warned_nodes = new Set<string>();

    /**
     * Interval revisions already reported, keyed by the request they answered rather than by the node
     * that revealed them — a whole node list revised the same way is one fact, and deserves one line.
     * Cleared with the connection, so the next `start()` reports against the server it finds then.
     */
    readonly #warned_intervals = new Set<string>();

    /**
     * The OPC UA client, or null when not connected.
     */
    #client: OpcUaClient | null = null;

    /**
     * The session opened on the server, or null when not connected.
     */
    #session: OpcUaSession | null = null;

    /**
     * The subscription carrying every monitored item, or null when not subscribed.
     */
    #subscription: OpcUaSubscription | null = null;

    /**
     *
     */
    constructor(config: OpcUaTransportConfig, sink: EventSink) {
        if (!config.endpoint_url) {
            throw new Error("endpoint_url is required in the OPC UA transport config");
        }
        this.#nodes = normalizeNodes(config.nodes);
        this.#security = resolveSecurity(config);
        this.#config = config;
        this.#sink = sink;
    }

    /**
     * Connect to the server, open a session and subscribe to every configured node.
     */
    async start(): Promise<void> {
        let opcua: OpcUaClientModule;
        try {
            opcua = (await import("node-opcua-client")) as OpcUaClientModule;
        } catch {
            throw new Error(
                'The OPC UA transport requires the optional dependency "node-opcua-client". ' +
                    "Install it with `npm install node-opcua-client`.",
            );
        }

        const endpoint_url = this.#config.endpoint_url;
        const client = opcua.OPCUAClient.create({
            applicationName: this.#config.application_name ?? "livelink-agent",
            // Servers routinely advertise their endpoint under a hostname the client cannot resolve
            // — a PLC on a plant network almost always does. Refusing to connect over that is never
            // what the caller meant by giving us a reachable URL.
            endpointMustExist: false,
            keepSessionAlive: true,
            securityMode: this.#security.mode,
            securityPolicy: this.#security.policy,
            connectionStrategy: {
                initialDelay: 1_000,
                maxDelay: 10_000,
                maxRetry: this.#config.max_retry ?? DEFAULT_MAX_RETRY,
            },
        });
        this.#client = client;

        try {
            await this.#subscribe(opcua, client, endpoint_url);
        } catch (error) {
            // Nothing upstream tears down a transport whose `start` rejected, so a connection that
            // came up before the failing step has to be released here.
            await this.stop();
            throw error;
        }
    }

    /**
     * Terminate the subscription, close the session and disconnect. Safe when never started, and
     * safe when only part of the connection was ever established.
     */
    async stop(): Promise<void> {
        const subscription = this.#subscription;
        const session = this.#session;
        const client = this.#client;
        this.#subscription = null;
        this.#session = null;
        this.#client = null;
        this.#warned_nodes.clear();
        this.#warned_intervals.clear();

        await closeQuietly(() => subscription?.terminate());
        await closeQuietly(() => session?.close());
        await closeQuietly(() => client?.disconnect());
    }

    /**
     * Open the session and put every configured node under one subscription.
     *
     * @param opcua The lazily loaded client module.
     * @param client The client to connect with.
     * @param endpoint_url The endpoint to connect to.
     */
    async #subscribe(opcua: OpcUaClientModule, client: OpcUaClient, endpoint_url: string): Promise<void> {
        client.on("connection_lost", () => console.warn(`[opcua-transport] Lost ${endpoint_url}, reconnecting...`));
        client.on("connection_reestablished", () => console.log(`[opcua-transport] Reconnected to ${endpoint_url}`));

        console.log(`[opcua-transport] Connecting to ${endpoint_url}...`);
        await client.connect(endpoint_url);
        this.#session = await client.createSession(this.#userIdentity());

        const publishing_interval = this.#config.publishing_interval ?? DEFAULT_PUBLISHING_INTERVAL;
        const subscription = opcua.ClientSubscription.create(this.#session, {
            requestedPublishingInterval: publishing_interval,
            // Both counts are in publishing intervals, and the specification wants the lifetime to
            // be at least three keep-alives.
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            // 0 = no limit: the cap exists to protect small servers, and throttling it here would
            // only spread one publication of a wide node list over several.
            maxNotificationsPerPublish: 0,
            publishingEnabled: true,
            priority: 10,
        });
        this.#subscription = subscription;
        subscription.on("internal_error", error => console.error(`[opcua-transport] Subscription failed:`, error));
        // The server answers `create()` asynchronously, and what it answers is the interval that
        // actually holds — see `#reportRevision`.
        subscription.on("started", () => {
            if (this.#subscription !== subscription) {
                return;
            }
            this.#reportRevision("publishing interval", publishing_interval, subscription.publishingInterval);
        });

        for (const node of this.#nodes) {
            const sampling_interval = node.sampling_interval ?? this.#config.sampling_interval ?? publishing_interval;
            const item = opcua.ClientMonitoredItem.create(
                subscription,
                { nodeId: node.node_id, attributeId: ATTRIBUTE_ID_VALUE },
                {
                    samplingInterval: sampling_interval,
                    discardOldest: true,
                    queueSize: this.#config.queue_size ?? DEFAULT_QUEUE_SIZE,
                },
                TIMESTAMPS_TO_RETURN_BOTH,
            );
            item.on("changed", data_value => void this.#handleSample(node, data_value));
            item.on("err", message => console.error(`[opcua-transport] Cannot monitor ${node.node_id}: ${message}`));
            item.on("initialized", () => {
                if (this.#subscription !== subscription) {
                    return;
                }
                this.#reportRevision(
                    "sampling interval",
                    sampling_interval,
                    item.result?.revisedSamplingInterval,
                    node.node_id,
                );
            });
        }

        console.log(`[opcua-transport] Connected, monitoring ${this.#nodes.length} node(s)`);
    }

    /**
     * The identity to open the session with, or undefined to connect anonymously.
     */
    #userIdentity(): OpcUaUserIdentity | undefined {
        const { username, password } = this.#config;
        if (username === undefined) {
            return undefined;
        }
        return { type: USER_TOKEN_TYPE_USER_NAME, userName: username, password: password ?? "" };
    }

    /**
     * Push a value change into the sink, on the node's channel, carrying the server's own clock.
     *
     * @param node The node the sample came from.
     * @param data_value The sample, as delivered by the monitored item.
     */
    async #handleSample(node: OpcUaNodeSpec, data_value: OpcUaDataValue): Promise<void> {
        // `stop()` clears the subscription before tearing anything down, so a publication already
        // in flight when it was called never reaches a sink that has been let go of.
        if (this.#subscription === null) {
            return;
        }

        const status_code = data_value.statusCode?.value ?? 0;
        const status = data_value.statusCode?.name ?? "Good";
        if (status_code >>> 30 > STATUS_SEVERITY_UNCERTAIN) {
            this.#warnOnce(node.node_id, `${node.node_id} reports ${status}, samples dropped`);
            return;
        }

        const value = decodeOpcUaVariant(data_value.value);
        if (value === undefined) {
            this.#warnOnce(node.node_id, `${node.node_id} published no value, samples dropped`);
            return;
        }
        this.#warned_nodes.delete(node.node_id);

        const source_timestamp = data_value.sourceTimestamp ?? data_value.serverTimestamp ?? undefined;
        try {
            await this.#sink.ingest({
                channel: node.channel ?? node.node_id,
                payload: { node_id: node.node_id, value, status },
                received_at: new Date(),
                ...(source_timestamp ? { source_timestamp } : {}),
                metadata: { transport: "opcua", status_code, server_timestamp: data_value.serverTimestamp },
            });
        } catch (error) {
            console.error(`[opcua-transport] Sink failed:`, error);
        }
    }

    /**
     * Report an interval the server revised to something slower than what was asked for.
     *
     * Requesting a pace is all a client can do — the server answers with the one it will hold to, and
     * absorbing that answer silently is how a scene ends up moving at half the rate its configuration
     * describes, with nothing anywhere to say why. Most servers floor the publishing interval at
     * 50 ms; a node can also come back with the fastest its device can be read.
     *
     * A revision to something *faster* than requested costs the caller nothing and is not reported.
     *
     * @param what The interval being reported on, as it reads in the message.
     * @param requested The value asked for, in milliseconds.
     * @param revised The value the server answered with, if it gave one.
     * @param node_id The node the revision applies to, for a per-node interval.
     */
    #reportRevision(what: string, requested: number, revised: number | undefined, node_id?: string): void {
        if (revised === undefined || !(revised > requested + INTERVAL_REVISION_EPSILON_MS)) {
            return;
        }

        const key = `${what}:${requested}->${revised}`;
        if (this.#warned_intervals.has(key)) {
            return;
        }
        this.#warned_intervals.add(key);

        const subject = node_id === undefined ? what : `${what} of ${node_id}`;
        console.warn(
            `[opcua-transport] The server revised the ${subject} from ${requested} ms up to ${revised} ms — ` +
                `it will not go faster than that, whatever this transport requests.`,
        );
    }

    /**
     * Report a node as unusable, once per outage.
     *
     * @param node_id The node the message is about.
     * @param message The message to log.
     */
    #warnOnce(node_id: string, message: string): void {
        if (this.#warned_nodes.has(node_id)) {
            return;
        }
        this.#warned_nodes.add(node_id);
        console.warn(`[opcua-transport] ${message}`);
    }
}
