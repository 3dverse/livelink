//------------------------------------------------------------------------------
// Everything the OPC UA transport needs to know about `node-opcua-client` **without importing it**.
//
// That package is an optional peer this repository deliberately does not install *here*: it is the
// only mature OPC UA stack for TypeScript, but its dependency tree is ~90 `node-opcua-*` packages,
// and {@link OpcUaTransport} calls six of its methods. So the module is described here instead, and
// the lazy `import("node-opcua-client")` in `start()` is cast to {@link OpcUaClientModule} — the
// compiler accepts the specifier thanks to the ambient declaration in `optional-peers.d.ts`.
// (`samples/` does install it, in its own `node_modules` off this resolution path, so that the OPC
// UA sample can actually connect to a PLC. Nothing here sees it.)
//
// The file has two halves, and they carry very different risk:
//
//   - **Specification constants.** Attribute ids, data types, security modes, status severities.
//     These travel on the wire and are fixed by the OPC UA specification (Parts 4 and 6), so
//     hard-coding them cannot drift: node-opcua's enums merely spell them out. `AttributeIds.Value`
//     has been `13` since 2006 and will stay `13`.
//   - **The structural module view.** This one mirrors an API rather than a standard, so it *can*
//     drift silently — a signature change in node-opcua would not fail to compile here, and the
//     transport's tests run against a fake. It is kept as small as possible for that reason: three
//     classes, and only the members actually called.
//
// To go back to the real types instead, install `node-opcua-client` as a devDependency of this
// package, drop the ambient declaration and replace the second half with a single `import type` —
// the first half can stay either way, since the constants are cheaper to read than the enum lookups
// they replace.

//------------------------------------------------------------------------------
// Specification constants.

/**
 * `AttributeIds.Value`, the only attribute the transport monitors.
 */
export const ATTRIBUTE_ID_VALUE = 13;

/**
 * `TimestampsToReturn.Both`: the source clock is the one worth carrying, the server clock is the
 * fallback when a server does not keep one.
 */
export const TIMESTAMPS_TO_RETURN_BOTH = 2;

/**
 * `UserTokenType.UserName`, used when the config carries credentials.
 */
export const USER_TOKEN_TYPE_USER_NAME = 1;

/**
 * `VariantArrayType.Scalar`.
 */
export const VARIANT_ARRAY_TYPE_SCALAR = 0;

/**
 * `DataType.Int64` and `DataType.UInt64` — the two types node-opcua hands over as a `[high, low]`
 * pair rather than a number.
 */
export const DATA_TYPE_INT64 = 8;
export const DATA_TYPE_UINT64 = 9;

/**
 * Severity lives in the top two bits of a status code: `0` is Good, `1` is Uncertain, anything above
 * is Bad. This is what node-opcua's `StatusCode.isGood()` / `isUncertain()` read.
 */
export const STATUS_SEVERITY_UNCERTAIN = 1;

/**
 * `MessageSecurityMode`, by name. The names are also the transport's config vocabulary, so this map
 * doubles as the validator for `security_mode`.
 */
export const MESSAGE_SECURITY_MODES: Record<string, number | undefined> = { None: 1, Sign: 2, SignAndEncrypt: 3 };

/**
 * The security policy short names defined by the specification, and the namespace that turns one
 * into the policy URI the client expects — which is exactly what the values of node-opcua's
 * `SecurityPolicy` enum are.
 */
export const SECURITY_POLICIES = [
    "None",
    "Basic128Rsa15",
    "Basic256",
    "Basic256Sha256",
    "Aes128_Sha256_RsaOaep",
    "Aes256_Sha256_RsaPss",
];
export const SECURITY_POLICY_URI_PREFIX = "http://opcfoundation.org/UA/SecurityPolicy#";

//------------------------------------------------------------------------------
// Structural view of the module.

/**
 * A variant, as node-opcua delivers it: the decoded value plus what is needed to know how to read it
 * back.
 *
 * @internal
 */
export type OpcUaVariant = {
    value?: unknown;
    dataType?: number;
    arrayType?: number;
};

/**
 * A data value, as node-opcua delivers it to a monitored item's `changed` listener.
 *
 * @internal
 */
export type OpcUaDataValue = {
    value?: OpcUaVariant | null;
    statusCode?: { value?: number; name?: string } | null;
    sourceTimestamp?: Date | null;
    serverTimestamp?: Date | null;
};

/**
 * The `node-opcua-client` module itself, reduced to the three classes the transport constructs.
 *
 * @internal
 */
export type OpcUaClientModule = {
    OPCUAClient: {
        create(options: {
            applicationName: string;
            endpointMustExist: boolean;
            keepSessionAlive: boolean;
            securityMode: number;
            securityPolicy: string;
            connectionStrategy: { initialDelay: number; maxDelay: number; maxRetry: number };
        }): OpcUaClient;
    };
    ClientSubscription: {
        create(
            session: OpcUaSession,
            options: {
                requestedPublishingInterval: number;
                requestedLifetimeCount: number;
                requestedMaxKeepAliveCount: number;
                maxNotificationsPerPublish: number;
                publishingEnabled: boolean;
                priority: number;
            },
        ): OpcUaSubscription;
    };
    ClientMonitoredItem: {
        create(
            subscription: OpcUaSubscription,
            item_to_monitor: { nodeId: string; attributeId: number },
            parameters: { samplingInterval: number; discardOldest: boolean; queueSize: number },
            timestamps_to_return: number,
        ): OpcUaMonitoredItem;
    };
};

/**
 * The identity a session is opened with. Omitted = anonymous.
 *
 * @internal
 */
export type OpcUaUserIdentity = { type: number; userName: string; password: string };

/**
 * @see OpcUaClientModule
 *
 * @internal
 */
export type OpcUaClient = {
    connect(endpoint_url: string): Promise<void>;
    createSession(user_identity?: OpcUaUserIdentity): Promise<OpcUaSession>;
    disconnect(): Promise<void>;
    on(event: "connection_lost" | "connection_reestablished", listener: () => void): void;
};

/**
 * @see OpcUaClientModule
 *
 * @internal
 */
export type OpcUaSession = { close(): Promise<void> };

/**
 * @see OpcUaClientModule
 *
 * @internal
 */
export type OpcUaSubscription = {
    /**
     * The publishing interval the server **revised** the request to, which is the only one that
     * describes how the subscription actually behaves. Readable from `"started"` on.
     */
    readonly publishingInterval?: number;

    terminate(): Promise<void>;
    on(event: "internal_error", listener: (error: Error) => void): void;
    /**
     * `create()` returns before the server has answered; this fires when the CreateSubscription
     * response lands, and again whenever node-opcua recreates the subscription after a reconnection.
     */
    on(event: "started", listener: (subscription_id: number) => void): void;
};

/**
 * @see OpcUaClientModule
 *
 * @internal
 */
export type OpcUaMonitoredItem = {
    /**
     * The `MonitoredItemCreateResult` the server answered with, carrying the parameters it
     * **revised** the request to. Readable from `"initialized"` on.
     */
    readonly result?: { revisedSamplingInterval?: number; revisedQueueSize?: number } | null;

    on(event: "changed", listener: (data_value: OpcUaDataValue) => void): void;
    on(event: "err", listener: (message: string) => void): void;
    /**
     * Fires once the server has answered the CreateMonitoredItems request, i.e. once
     * {@link OpcUaMonitoredItem.result} holds something.
     */
    on(event: "initialized", listener: () => void): void;
};
