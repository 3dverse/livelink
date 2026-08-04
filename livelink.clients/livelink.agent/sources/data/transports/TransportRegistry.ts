//------------------------------------------------------------------------------
import type { EventSink, Transport } from "../Transport";
import { PlaybackTransport, type FileTransportConfig, type PlaybackTransportConfig } from "./PlaybackTransport";
import { MqttTransport, type MqttTransportConfig } from "./MqttTransport";
import { AzureEventHubTransport, type AzureEventHubTransportConfig } from "./AzureEventHubTransport";
import { OpcUaTransport, type OpcUaTransportConfig } from "./OpcUaTransport";

/**
 * A fully-resolved transport configuration: the registered kind and its kind-specific config.
 * The built-in kinds are typed below; custom kinds carry whatever config their factory expects.
 *
 * @category Data
 */
export type TransportSpec =
    | { kind: "playback"; config: PlaybackTransportConfig }
    | { kind: "file"; config: FileTransportConfig }
    | { kind: "mqtt"; config: MqttTransportConfig }
    | { kind: "azure-event-hub"; config: AzureEventHubTransportConfig }
    | { kind: "opcua"; config: OpcUaTransportConfig }
    | { kind: string; config: unknown };

/**
 * The transport kinds bundled with the SDK.
 *
 * @category Data
 */
export type BuiltinTransportKind = "playback" | "file" | "mqtt" | "azure-event-hub" | "opcua";

/**
 * A fully-resolved configuration for a **built-in** transport, its config typed per kind.
 *
 * Unlike the open {@link TransportSpec} (whose `{ kind: string; config: unknown }` member defeats
 * per-kind narrowing so custom kinds can be registered), this closed union lets a consumer that
 * only exposes the bundled transports narrow the config by `kind`. Custom kinds still go through
 * {@link TransportSpec}.
 *
 * @category Data
 */
export type BuiltinTransportSpec =
    | { kind: "playback"; config: PlaybackTransportConfig }
    | { kind: "file"; config: FileTransportConfig }
    | { kind: "mqtt"; config: MqttTransportConfig }
    | { kind: "azure-event-hub"; config: AzureEventHubTransportConfig }
    | { kind: "opcua"; config: OpcUaTransportConfig };

/**
 * Builds a {@link Transport} bound to a sink from a kind-specific config.
 *
 * @category Data
 */
export type TransportFactory = (config: unknown, sink: EventSink) => Transport | Promise<Transport>;

/**
 * Registry of transport kinds.
 *
 * The {@link defaultTransportRegistry} ships with the built-in kinds (`"playback"`, `"mqtt"`,
 * `"azure-event-hub"`, `"opcua"`, plus `"file"` as a deprecated alias of `"playback"`); register
 * custom sources (a serial port, a proprietary bus, ...) under their own kind:
 *
 * ```typescript
 * defaultTransportRegistry.register({
 *     kind: "serial",
 *     factory: (config, sink) => new MySerialTransport(config as MySerialConfig, sink),
 * });
 * ```
 *
 * @category Data
 */
export class TransportRegistry {
    /**
     * The registered factories, keyed by kind.
     */
    readonly #factories = new Map<string, TransportFactory>();

    /**
     * The registered transport kinds.
     */
    get kinds(): Array<string> {
        return Array.from(this.#factories.keys());
    }

    /**
     * Register a transport factory under a kind.
     *
     * @throws If the kind is already registered.
     */
    register({ kind, factory }: { kind: string; factory: TransportFactory }): void {
        if (this.#factories.has(kind)) {
            throw new Error(`Transport kind "${kind}" is already registered.`);
        }
        this.#factories.set(kind, factory);
    }

    /**
     * Whether a transport kind is registered.
     */
    has({ kind }: { kind: string }): boolean {
        return this.#factories.has(kind);
    }

    /**
     * Build a transport bound to a sink from a spec.
     *
     * @throws If the spec's kind is not registered.
     */
    async create({ spec, sink }: { spec: TransportSpec; sink: EventSink }): Promise<Transport> {
        const factory = this.#factories.get(spec.kind);
        if (!factory) {
            throw new Error(`Unknown transport kind "${spec.kind}". Registered kinds: ${this.kinds.join(", ")}.`);
        }
        return factory(spec.config, sink);
    }
}

/**
 * The default transport registry, pre-populated with the built-in transport kinds.
 *
 * @category Data
 */
export const defaultTransportRegistry = new TransportRegistry();

defaultTransportRegistry.register({
    kind: "playback",
    factory: (config, sink) => new PlaybackTransport(config as PlaybackTransportConfig, sink),
});
// Deprecated alias of `"playback"`, kept so a config naming the file-only transport still resolves.
// It also keeps that transport's old `"file"` default channel, which `"playback"` has moved on from.
defaultTransportRegistry.register({
    kind: "file",
    factory: (config, sink) => {
        const { file_path, ...rest } = config as FileTransportConfig;
        return new PlaybackTransport({ default_channel: "file", ...rest, source: { file_path } }, sink);
    },
});
defaultTransportRegistry.register({
    kind: "mqtt",
    factory: (config, sink) => new MqttTransport(config as MqttTransportConfig, sink),
});
defaultTransportRegistry.register({
    kind: "azure-event-hub",
    factory: (config, sink) => new AzureEventHubTransport(config as AzureEventHubTransportConfig, sink),
});
defaultTransportRegistry.register({
    kind: "opcua",
    factory: (config, sink) => new OpcUaTransport(config as OpcUaTransportConfig, sink),
});

/**
 * Builds a transport bound to a sink from a spec, using the
 * {@link defaultTransportRegistry}.
 *
 * @category Data
 */
export function createTransport(spec: TransportSpec, sink: EventSink): Promise<Transport> {
    return defaultTransportRegistry.create({ spec, sink });
}
