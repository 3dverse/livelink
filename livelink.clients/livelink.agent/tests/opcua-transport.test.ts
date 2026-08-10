import { describe, it, expect, vi, beforeEach } from "vitest";

import { OpcUaTransport, decodeOpcUaVariant } from "../sources/data/transports/OpcUaTransport";
import { defaultTransportRegistry } from "../sources/data/transports/TransportRegistry";
import type { IngestEvent } from "../sources/data/IngestEvent";
import { fake_opcua } from "./fakes/node-opcua-client";
import type { OpcUaDataValue, OpcUaVariant } from "../sources/data/transports/OpcUaClientModule";
import type { DataValue, Variant } from "node-opcua-client";

//------------------------------------------------------------------------------
// `OpcUaVariant` / `OpcUaDataValue` name only the fields the decoder reads, so the samples below can
// be plain object literals rather than fully constructed `DataValue`s. These assertions are what
// keeps that narrowing honest: they fail at *typecheck* time (`npm run typecheck`) if node-opcua
// ever delivers something the projections no longer describe.
//
// Field by field rather than whole-object, deliberately. Every field of both projections is
// optional, which makes them **weak types**: `const x: OpcUaVariant = someVariant` succeeds as long
// as a single field still overlaps, so an upstream *rename* would slip straight through. Indexing
// each field turns a rename into "property does not exist on type 'Variant'" and a retype into a
// failed assignment.
//
// The direction is the one that matters: the real class must be assignable to the projection, i.e.
// the projection is a supertype of what actually arrives at runtime.
type Assignable<From, To> = [From] extends [To] ? true : never;

export const variant_value_matches: Assignable<Variant["value"], OpcUaVariant["value"]> = true;
export const variant_data_type_matches: Assignable<Variant["dataType"], OpcUaVariant["dataType"]> = true;
export const variant_array_type_matches: Assignable<Variant["arrayType"], OpcUaVariant["arrayType"]> = true;

export const data_value_value_matches: Assignable<DataValue["value"], OpcUaDataValue["value"]> = true;
export const data_value_status_matches: Assignable<DataValue["statusCode"], OpcUaDataValue["statusCode"]> = true;
export const data_value_source_ts_matches: Assignable<
    DataValue["sourceTimestamp"],
    OpcUaDataValue["sourceTimestamp"]
> = true;
export const data_value_server_ts_matches: Assignable<
    DataValue["serverTimestamp"],
    OpcUaDataValue["serverTimestamp"]
> = true;

//------------------------------------------------------------------------------
// `MessageSecurityMode` and `DataType`, per the OPC UA specification — the same constants the
// transport hard-codes, spelled out again here so a typo in one is not a typo in both.
const SECURITY_MODE_NONE = 1;
const SECURITY_MODE_SIGN_AND_ENCRYPT = 3;
const DATA_TYPE_DOUBLE = 11;
const DATA_TYPE_INT64 = 8;
const DATA_TYPE_UINT64 = 9;
const VARIANT_ARRAY_TYPE_ARRAY = 1;

const GOOD = { value: 0, name: "Good" };
const BAD_NOT_CONNECTED = { value: 0x808a_0000, name: "BadNotConnected" };
const UNCERTAIN_LAST_USABLE = { value: 0x4060_0000, name: "UncertainLastUsableValue" };

//------------------------------------------------------------------------------
class CollectingSink {
    events: Array<IngestEvent> = [];

    ingest = (event: IngestEvent): void => {
        this.events.push(event);
    };
}

/**
 * Samples are handed to the sink from a `void`-ed async handler, so a publication needs one turn of
 * the event loop before it can be asserted on.
 */
function flush(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

//------------------------------------------------------------------------------
let sink: CollectingSink;

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake_opcua.reset();
    sink = new CollectingSink();
});

//------------------------------------------------------------------------------
describe("the payload projections", () => {
    it("still describe what node-opcua delivers (enforced at typecheck time)", () => {
        expect([
            variant_value_matches,
            variant_data_type_matches,
            variant_array_type_matches,
            data_value_value_matches,
            data_value_status_matches,
            data_value_source_ts_matches,
            data_value_server_ts_matches,
        ]).toEqual([true, true, true, true, true, true, true]);
    });
});

//------------------------------------------------------------------------------
describe("decodeOpcUaVariant", () => {
    it("passes scalars through untouched", () => {
        expect(decodeOpcUaVariant({ value: 21.5, dataType: DATA_TYPE_DOUBLE })).toBe(21.5);
        expect(decodeOpcUaVariant({ value: "running" })).toBe("running");
        expect(decodeOpcUaVariant({ value: false })).toBe(false);

        const date = new Date("2026-07-31T10:00:00Z");
        expect(decodeOpcUaVariant({ value: date })).toBe(date);
    });

    it("turns typed arrays into plain arrays", () => {
        const decoded = decodeOpcUaVariant({
            value: Float64Array.from([1.5, 2.5]),
            dataType: DATA_TYPE_DOUBLE,
            arrayType: VARIANT_ARRAY_TYPE_ARRAY,
        });

        expect(Array.isArray(decoded)).toBe(true);
        expect(decoded).toEqual([1.5, 2.5]);
    });

    it("recombines the [high, low] halves of a 64-bit integer", () => {
        expect(decodeOpcUaVariant({ value: [0, 42], dataType: DATA_TYPE_INT64 })).toBe(42);
        expect(decodeOpcUaVariant({ value: [1, 0], dataType: DATA_TYPE_UINT64 })).toBe(4_294_967_296);
        // Two's complement: an all-ones pair is -1, not a pair of large positives.
        expect(decodeOpcUaVariant({ value: [-1, 0xffff_ffff], dataType: DATA_TYPE_INT64 })).toBe(-1);
    });

    it("recombines each element of a 64-bit integer array", () => {
        const decoded = decodeOpcUaVariant({
            value: [
                [0, 7],
                [1, 0],
            ],
            dataType: DATA_TYPE_INT64,
            arrayType: VARIANT_ARRAY_TYPE_ARRAY,
        });

        expect(decoded).toEqual([7, 4_294_967_296]);
    });

    it("narrows a bigint to a number", () => {
        expect(decodeOpcUaVariant({ value: 90n, dataType: DATA_TYPE_INT64 })).toBe(90);
    });

    it("reports a variant carrying no value as undefined", () => {
        expect(decodeOpcUaVariant({ value: null })).toBeUndefined();
        expect(decodeOpcUaVariant({})).toBeUndefined();
        expect(decodeOpcUaVariant(null)).toBeUndefined();
    });
});

//------------------------------------------------------------------------------
describe("OpcUaTransport configuration", () => {
    it("rejects a config it could never connect with", () => {
        expect(() => new OpcUaTransport({ endpoint_url: "", nodes: ["ns=2;i=1"] }, sink)).toThrow(
            /endpoint_url is required/,
        );
        expect(() => new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: [] }, sink)).toThrow(
            /At least one node/,
        );
        expect(
            () => new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: [{ node_id: "" }] }, sink),
        ).toThrow(/needs a node_id/);
    });

    it("rejects an unknown or incoherent security setting", () => {
        const base = { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] };

        expect(() => new OpcUaTransport({ ...base, security_mode: "Encrypt" as "Sign" }, sink)).toThrow(
            /Unknown OPC UA security_mode "Encrypt"/,
        );
        expect(() => new OpcUaTransport({ ...base, security_policy: "Basic256SHA256" }, sink)).toThrow(
            /Unknown OPC UA security_policy/,
        );
        expect(() => new OpcUaTransport({ ...base, security_mode: "Sign", security_policy: "None" }, sink)).toThrow(
            /disagree/,
        );
    });

    it("defaults each security setting from the other", async () => {
        await new OpcUaTransport(
            { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"], security_policy: "Basic256Sha256" },
            sink,
        ).start();

        expect(fake_opcua.client.options.securityMode).toBe(SECURITY_MODE_SIGN_AND_ENCRYPT);
        expect(fake_opcua.client.options.securityPolicy).toBe(
            "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256",
        );
    });

    it("takes a full policy URI, for a policy this SDK predates", async () => {
        const policy = "http://opcfoundation.org/UA/SecurityPolicy#ECC_nistP256";
        await new OpcUaTransport(
            { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"], security_mode: "Sign", security_policy: policy },
            sink,
        ).start();

        expect(fake_opcua.client.options.securityPolicy).toBe(policy);
    });
});

//------------------------------------------------------------------------------
describe("OpcUaTransport subscription", () => {
    it("connects anonymously and unsecured by default", async () => {
        await new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] }, sink).start();

        expect(fake_opcua.client.endpoint_url).toBe("opc.tcp://plc:4840");
        expect(fake_opcua.client.user_identity).toBeUndefined();
        expect(fake_opcua.client.options.securityMode).toBe(SECURITY_MODE_NONE);
        expect(fake_opcua.client.options.endpointMustExist).toBe(false);
    });

    it("opens the session with a user name when credentials are given", async () => {
        await new OpcUaTransport(
            { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"], username: "operator", password: "s3cret" },
            sink,
        ).start();

        expect(fake_opcua.client.user_identity).toEqual({ type: 1, userName: "operator", password: "s3cret" });
    });

    it("monitors every node, sampling per node then per transport then at the publishing rate", async () => {
        await new OpcUaTransport(
            {
                endpoint_url: "opc.tcp://plc:4840",
                nodes: ["ns=2;i=1", { node_id: "ns=2;i=2" }, { node_id: "ns=2;i=3", sampling_interval: 50 }],
                publishing_interval: 500,
                sampling_interval: 250,
            },
            sink,
        ).start();

        expect(fake_opcua.items.map(item => item.node_id)).toEqual(["ns=2;i=1", "ns=2;i=2", "ns=2;i=3"]);
        expect(fake_opcua.items.map(item => item.parameters.samplingInterval)).toEqual([250, 250, 50]);
        expect(fake_opcua.subscription.options.requestedPublishingInterval).toBe(500);
    });

    it("falls back to the publishing interval when no sampling rate is given", async () => {
        await new OpcUaTransport(
            { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"], publishing_interval: 750 },
            sink,
        ).start();

        expect(fake_opcua.items[0].parameters.samplingInterval).toBe(750);
        expect(fake_opcua.items[0].parameters.queueSize).toBe(1);
    });
});

//------------------------------------------------------------------------------
// What a client asks for is a request; what the server answers with is what holds. Most servers floor
// the publishing interval at 50 ms, so a caller asking for 25 gets half the sample rate they
// configured — which has to be said rather than absorbed.
describe("OpcUaTransport interval revisions", () => {
    /**
     * Bring a transport up on `nodes`, asking for `interval` as both intervals.
     */
    async function started(interval: number, nodes: Array<string>): Promise<void> {
        await new OpcUaTransport(
            {
                endpoint_url: "opc.tcp://plc:4840",
                nodes,
                publishing_interval: interval,
                sampling_interval: interval,
            },
            sink,
        ).start();
    }

    it("reports a publishing interval the server revised upward", async () => {
        await started(25, ["ns=2;i=1"]);

        fake_opcua.subscription.start(50);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("revised the publishing interval from 25 ms up to 50 ms"),
        );
    });

    it("reports one revision however many nodes reveal it", async () => {
        await started(25, ["ns=2;i=1", "ns=2;i=2", "ns=2;i=3"]);

        for (const item of fake_opcua.items) {
            item.initialize({ revisedSamplingInterval: 50 });
        }

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("revised the sampling interval of ns=2;i=1 from 25 ms up to 50 ms"),
        );
    });

    it("reports each distinct revision, so a node with its own floor is not swallowed", async () => {
        await started(25, ["ns=2;i=1", "ns=2;i=2"]);

        fake_opcua.items[0].initialize({ revisedSamplingInterval: 50 });
        fake_opcua.items[1].initialize({ revisedSamplingInterval: 1_000 });

        expect(console.warn).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenLastCalledWith(expect.stringContaining("ns=2;i=2 from 25 ms up to 1000 ms"));
    });

    it("says nothing when the server honours the request, or beats it", async () => {
        await started(100, ["ns=2;i=1", "ns=2;i=2"]);

        fake_opcua.subscription.start(100);
        fake_opcua.items[0].initialize({ revisedSamplingInterval: 100 });
        // Faster than asked for costs the caller nothing.
        fake_opcua.items[1].initialize({ revisedSamplingInterval: 50 });

        expect(console.warn).not.toHaveBeenCalled();
    });

    it("says nothing when the server answers nothing at all", async () => {
        await started(25, ["ns=2;i=1"]);

        // A monitored item that reports no result is not evidence of a revision.
        fake_opcua.items[0].initialize();

        expect(console.warn).not.toHaveBeenCalled();
    });

    it("goes quiet once stopped, and reports afresh against the next server", async () => {
        const transport = new OpcUaTransport(
            { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"], publishing_interval: 25 },
            sink,
        );
        await transport.start();
        const stale = fake_opcua.subscription;
        await transport.stop();

        // A publication answered after the teardown has no transport left to report to.
        stale.start(50);
        expect(console.warn).not.toHaveBeenCalled();

        await transport.start();
        fake_opcua.subscription.start(50);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });
});

//------------------------------------------------------------------------------
describe("OpcUaTransport sampling", () => {
    /**
     * Bring a transport up on one aliased node, ready to be published to.
     */
    async function started(): Promise<OpcUaTransport> {
        const transport = new OpcUaTransport(
            {
                endpoint_url: "opc.tcp://plc:4840",
                nodes: [{ node_id: 'ns=3;s="DB1"."Temp"', channel: "plc/line1/temperature" }],
            },
            sink,
        );
        await transport.start();
        return transport;
    }

    it("publishes a sample on the node's channel, carrying the server's clock", async () => {
        await started();
        const source_timestamp = new Date("2026-07-31T09:00:00Z");
        const server_timestamp = new Date("2026-07-31T09:00:01Z");

        fake_opcua.items[0].publish({
            value: { value: 21.5, dataType: DATA_TYPE_DOUBLE },
            statusCode: GOOD,
            sourceTimestamp: source_timestamp,
            serverTimestamp: server_timestamp,
        });
        await flush();

        expect(sink.events).toHaveLength(1);
        expect(sink.events[0]).toMatchObject({
            channel: "plc/line1/temperature",
            payload: { node_id: 'ns=3;s="DB1"."Temp"', value: 21.5, status: "Good" },
            source_timestamp,
            metadata: { transport: "opcua", status_code: 0, server_timestamp },
        });
        expect(sink.events[0].received_at).toBeInstanceOf(Date);
    });

    it("falls back to the server timestamp when the source has no clock", async () => {
        await started();
        const server_timestamp = new Date("2026-07-31T09:00:01Z");

        fake_opcua.items[0].publish({
            value: { value: 1, dataType: DATA_TYPE_DOUBLE },
            statusCode: GOOD,
            sourceTimestamp: null,
            serverTimestamp: server_timestamp,
        });
        await flush();

        expect(sink.events[0].source_timestamp).toBe(server_timestamp);
    });

    it("channels a node on its id when no alias is given", async () => {
        const transport = new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] }, sink);
        await transport.start();

        fake_opcua.items[0].publish({ value: { value: 7 }, statusCode: GOOD });
        await flush();

        expect(sink.events[0].channel).toBe("ns=2;i=1");
    });

    it("decodes a 64-bit counter on the way through", async () => {
        await started();

        fake_opcua.items[0].publish({ value: { value: [1, 0], dataType: DATA_TYPE_UINT64 }, statusCode: GOOD });
        await flush();

        expect(sink.events[0].payload).toMatchObject({ value: 4_294_967_296 });
    });

    it("forwards an uncertain sample, which still carries a value", async () => {
        await started();

        fake_opcua.items[0].publish({ value: { value: 20 }, statusCode: UNCERTAIN_LAST_USABLE });
        await flush();

        expect(sink.events).toHaveLength(1);
        expect(sink.events[0].payload).toMatchObject({ status: "UncertainLastUsableValue" });
    });

    it("drops a bad sample and reports the node once per outage", async () => {
        await started();
        const bad = { value: { value: 0 }, statusCode: BAD_NOT_CONNECTED };

        fake_opcua.items[0].publish(bad);
        fake_opcua.items[0].publish(bad);
        await flush();

        expect(sink.events).toHaveLength(0);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("BadNotConnected"));

        // A node that recovers and fails again is a new outage, and gets reported anew.
        fake_opcua.items[0].publish({ value: { value: 21 }, statusCode: GOOD });
        await flush();
        fake_opcua.items[0].publish(bad);
        await flush();

        expect(sink.events).toHaveLength(1);
        expect(console.warn).toHaveBeenCalledTimes(2);
    });

    it("drops a sample carrying no value at all", async () => {
        await started();

        fake_opcua.items[0].publish({ value: { value: null }, statusCode: GOOD });
        await flush();

        expect(sink.events).toHaveLength(0);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("published no value"));
    });

    it("keeps running when the sink throws", async () => {
        await started();
        sink.ingest = () => {
            throw new Error("scene is gone");
        };

        fake_opcua.items[0].publish({ value: { value: 1 }, statusCode: GOOD });
        await flush();

        expect(console.error).toHaveBeenCalledWith("[opcua-transport] Sink failed:", expect.any(Error));
    });
});

//------------------------------------------------------------------------------
describe("OpcUaTransport teardown", () => {
    it("terminates the subscription, closes the session and disconnects", async () => {
        const transport = new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] }, sink);
        await transport.start();
        const { client } = fake_opcua;
        const subscription = fake_opcua.subscription;

        await transport.stop();

        expect(subscription.terminated).toBe(true);
        expect(client.session?.closed).toBe(true);
        expect(client.disconnected).toBe(true);
    });

    it("is safe when never started, and when stopped twice", async () => {
        const transport = new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] }, sink);

        await expect(transport.stop()).resolves.toBeUndefined();

        await transport.start();
        await transport.stop();
        await expect(transport.stop()).resolves.toBeUndefined();
    });

    it("does not push a sample that was in flight when it was stopped", async () => {
        const transport = new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] }, sink);
        await transport.start();
        const item = fake_opcua.items[0];
        await transport.stop();

        item.publish({ value: { value: 1 }, statusCode: GOOD });
        await flush();

        expect(sink.events).toHaveLength(0);
    });

    it("releases the connection when a later step of start fails", async () => {
        fake_opcua.session_error = new Error("BadUserAccessDenied");
        const transport = new OpcUaTransport({ endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] }, sink);

        await expect(transport.start()).rejects.toThrow(/BadUserAccessDenied/);
        expect(fake_opcua.client.disconnected).toBe(true);
    });
});

//------------------------------------------------------------------------------
describe("opcua transport registration", () => {
    it("is a built-in kind of the default registry", async () => {
        expect(defaultTransportRegistry.has({ kind: "opcua" })).toBe(true);

        const transport = await defaultTransportRegistry.create({
            spec: { kind: "opcua", config: { endpoint_url: "opc.tcp://plc:4840", nodes: ["ns=2;i=1"] } },
            sink,
        });

        expect(transport).toBeInstanceOf(OpcUaTransport);
    });
});
