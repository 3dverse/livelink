//------------------------------------------------------------------------------
// Everything the OPC UA transport needs to know about `node-opcua-client`.
//
// That package stays an **optional peer** for consumers — `opc.tcp://` is raw TCP, so the transport
// is Node-only and most consumers never install it, which is why {@link OpcUaTransport.start} reaches
// it through a lazy `import()` and esbuild keeps it `external`. But it *is* a devDependency here, so
// the types below are the real ones and a signature change upstream fails the build rather than a
// PLC connection. (Every type in this file is `@internal`, so `stripInternal` deletes it from the
// emitted `.d.ts`: a consumer who installs no such peer never sees a reference to it.)
//
// The file has two halves:
//
//   - **Specification constants.** Attribute ids, data types, security modes, status severities.
//     These travel on the wire and are fixed by the OPC UA specification (Parts 4 and 6), so
//     hard-coding them cannot drift: node-opcua's enums merely spell them out. `AttributeIds.Value`
//     has been `13` since 2006 and will stay `13`. They are kept spelled out because they read more
//     cheaply than the enum lookups they replace.
//   - **The module types**, derived from the real module rather than restated — the instance types
//     come back out of the three `create` calls, so there is no hand-maintained shape left to drift.
//
// The two payload projections ({@link OpcUaVariant}, {@link OpcUaDataValue}) are the deliberate
// exception: they name only the fields the decoder reads, so a sample can be written as a plain
// object literal in a test instead of a fully constructed `DataValue`. `opcua-transport.test.ts`
// pins them against the real `DataValue` / `Variant` with type-level assertions, so narrowing them
// costs no drift detection.

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
// The module types.
//
// `import type` is erased at compile time, so naming these costs no runtime import: the transport
// still reaches the module only through the lazy `import()` in `start()`, and esbuild still keeps
// the package `external`. Aliases rather than derivations through the methods that produce them —
// `createSession` is overloaded three ways, and `Parameters<>` / `ReturnType<>` resolve against the
// last overload (the callback form), which yields the callback type and `void` instead of an
// identity and a session.

import type {
    ClientMonitoredItem,
    ClientSession,
    ClientSubscription,
    OPCUAClient,
    UserIdentityInfo,
} from "node-opcua-client";

/**
 * The `node-opcua-client` module, as the lazy `import()` in {@link OpcUaTransport.start} hands it
 * over. Naming the real module is what makes the calls the transport makes checked against the
 * upstream signatures.
 *
 * @internal
 */
export type OpcUaClientModule = typeof import("node-opcua-client");

/**
 * The identity a session is opened with. Omitted = anonymous.
 *
 * @internal
 */
export type OpcUaUserIdentity = UserIdentityInfo;

/**
 * Produced by `OPCUAClient.create`.
 *
 * @internal
 */
export type OpcUaClient = OPCUAClient;

/**
 * Produced by {@link OpcUaClient.createSession}.
 *
 * @internal
 */
export type OpcUaSession = ClientSession;

/**
 * Produced by `ClientSubscription.create`. Carries `publishingInterval`, the interval the server
 * **revised** the request to — the only one that describes how the subscription actually behaves,
 * readable from `"started"` on.
 *
 * @internal
 */
export type OpcUaSubscription = ClientSubscription;

/**
 * Produced by `ClientMonitoredItem.create`. Carries `result`, the `MonitoredItemCreateResult` the
 * server answered with — readable from `"initialized"` on, which is what tells you the revised
 * sampling interval and queue size.
 *
 * @internal
 */
export type OpcUaMonitoredItem = ClientMonitoredItem;

//------------------------------------------------------------------------------
// Payload projections.
//
// These two name only the fields {@link decodeOpcUaVariant} and the sample handler read, rather than
// aliasing node-opcua's `Variant` / `DataValue` classes. That keeps a test sample a plain object
// literal instead of a fully constructed `DataValue` — worth it for a decoder that is pure
// projection. `opcua-transport.test.ts` asserts at type level that the real classes are assignable
// to both, so narrowing them here still cannot drift away from what arrives at runtime.

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
