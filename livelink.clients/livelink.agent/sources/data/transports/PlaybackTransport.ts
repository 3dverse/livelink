//------------------------------------------------------------------------------
import type { EventSink, Transport } from "../Transport";
import { matchChannel } from "../util/channel";

/**
 * Where a {@link PlaybackTransport} reads its recording from.
 *
 * A recording is a *dump of an event stream*, not necessarily a file: the same bytes are just as
 * likely to arrive as a string already in memory, an HTTP response, or records the caller parsed
 * itself. Whatever the form, the recorded content is one of three shapes:
 *
 * - an **MQTT trace dump** — lines of `<topic> <json>`; the topic becomes the event's channel;
 * - a JSON array of **envelopes** — `{ "channel": "...", "payload": {...}, "timestamp": "..." }`;
 * - a JSON array of **bare payloads** — no channel information, so every event is replayed on
 *   {@link PlaybackTransportConfig.default_channel}.
 *
 * @category Data
 */
export type PlaybackSource =
    //--------------------------------------------------------------------------
    // Already in memory. A `string` is the dump *itself* — never a path or a URL, which are
    // spelled out below so the two can never be confused.
    | string
    | Uint8Array
    | ArrayBuffer
    /** Records the caller already parsed: envelopes or bare payloads, skipping `JSON.parse`. */
    | Array<unknown>

    //--------------------------------------------------------------------------
    // Read to completion before the replay starts (see the class doc).
    | ReadableStream<Uint8Array | string>
    | AsyncIterable<Uint8Array | string>

    //--------------------------------------------------------------------------
    // Located. These stay plain JSON, so a `TransportSpec` naming them survives a round trip
    // through a config file or an HTTP API.
    /** A path on the local file system. **Node.js only.** */
    | { file_path: string }
    /** Anything `fetch` can retrieve. Works in the browser and in Node.js. */
    | { url: string; init?: RequestInit }

    //--------------------------------------------------------------------------
    /** Produced on `start()`, for a source that cannot be built ahead of time. */
    | (() => PlaybackSource | Promise<PlaybackSource>);

/**
 * Configuration of a {@link PlaybackTransport}.
 *
 * @inline
 * @category Data
 */
export type PlaybackTransportConfig = {
    /**
     * The recording to replay.
     */
    source: PlaybackSource;

    /**
     * Only replay the messages whose channel matches this MQTT-style pattern (`+`/`*` = one segment,
     * trailing `#` = the rest) — e.g. `"uagv/+/+/+/visualization"` to replay only the position
     * frames out of a full VDA 5050 trace. Omitted = replay everything.
     */
    channel_filter?: string;

    /**
     * The channel given to messages that carry none (a bare-payload recording). Defaults to
     * `"playback"`.
     */
    default_channel?: string;

    /**
     * How fast to replay, relative to the recorded pace: `1` (the default) replays in real time,
     * `10` replays ten times faster. Only meaningful for a recording that carries timestamps —
     * without them messages are replayed back to back whatever the speed.
     */
    speed?: number;

    /**
     * Whether to start over when the recording ends. Defaults to `true`.
     */
    loop?: boolean;
};

/**
 * Configuration of the deprecated `"file"` transport kind.
 *
 * @deprecated Use {@link PlaybackTransportConfig} with `source: { file_path }` and the `"playback"`
 * kind.
 *
 * @category Data
 */
export type FileTransportConfig = {
    /** Path of the playback file. Relative paths resolve against the process working directory. */
    file_path: string;
    /** See {@link PlaybackTransportConfig.channel_filter}. */
    channel_filter?: string;
    /** See {@link PlaybackTransportConfig.default_channel}. */
    default_channel?: string;
};

/**
 * One message of a parsed recording.
 */
type PlaybackMessage = {
    channel: string;
    payload: unknown;
    /** Epoch milliseconds, or null when the message carries no usable timestamp. */
    timestamp: number | null;
};

/**
 * How many `() => source` hops are followed before giving up, so a factory returning itself fails
 * loudly instead of hanging.
 */
const MAX_SOURCE_INDIRECTIONS = 8;

/**
 * How many messages one timer tick may emit before yielding to the event loop, so a dense stretch
 * of a recording never starves it.
 */
const MAX_MESSAGES_PER_TICK = 256;

/**
 * Replays a recorded sequence of messages, pacing them from their own timestamps and looping when
 * the sequence ends.
 *
 * The recording comes from wherever {@link PlaybackSource} allows — a file, a URL, a string, a
 * buffer, a stream, an array of records — so the same transport drives a Node.js replay from disk
 * and a browser demo from a bundled dump. Only `{ file_path }` is Node-only.
 *
 * **It buffers the whole recording before replaying it.** Looping needs every message to stay in
 * memory, and pacing needs the first timestamp before the second message can be scheduled; a
 * streamed source is therefore drained to completion by `start()`. This is a replayer, not a reader
 * of live streams — for a genuinely live source, write a {@link Transport} that pushes as it reads.
 *
 * **The recorded channel is preserved**, so a mapping selecting on `channel` behaves identically
 * against a live broker and against a dump of that broker — which is the point of replaying in the
 * first place. Only a recording that carries no channel information at all falls back to a constant
 * ({@link PlaybackTransportConfig.default_channel}, `"playback"` by default).
 *
 * @category Data
 */
export class PlaybackTransport implements Transport {
    /**
     * The sink to push replayed events into.
     */
    readonly #sink: EventSink;

    /**
     * The transport configuration.
     */
    readonly #config: PlaybackTransportConfig;

    /**
     * The messages loaded from the recording.
     */
    #messages: Array<PlaybackMessage> = [];

    /**
     * The timer ID for the next scheduled message, or null if no message is scheduled.
     */
    #timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * The index of the next message to be sent.
     */
    #current_index = 0;

    /**
     * The timestamp when playback started, in epoch milliseconds, or null if not started.
     */
    #start_time: number | null = null;

    /**
     * The timestamp of the first message of the recording, in epoch milliseconds, or null if it has
     * none — in which case messages are replayed back to back.
     */
    #base_timestamp: number | null = null;

    /**
     * Whether the transport has been stopped. Used to prevent scheduling further messages after
     * stop. Cleared on start.
     */
    #stopped = false;

    /**
     *
     */
    constructor(config: PlaybackTransportConfig, sink: EventSink) {
        if (config.source === undefined || config.source === null) {
            throw new Error("source is required in transport config");
        }
        if (config.speed !== undefined && (!isFinite(config.speed) || config.speed <= 0)) {
            throw new Error(`speed must be a finite number greater than 0, got ${config.speed}`);
        }
        this.#sink = sink;
        this.#config = config;
    }

    /**
     * Read the recording and start replaying its messages.
     */
    async start(): Promise<void> {
        this.#stopped = false;

        const content = await readSource(this.#config.source);

        let messages: Array<PlaybackMessage>;
        try {
            messages = typeof content === "string" ? this.#parse(content) : this.#parseRecords(content);
        } catch (error) {
            throw new Error(
                `Failed to parse recording: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            );
        }

        const filter = this.#config.channel_filter;
        this.#messages =
            filter === undefined ? messages : messages.filter(message => matchChannel(filter, message.channel));

        if (messages.length > 0 && this.#messages.length === 0) {
            console.warn(
                `[playback-transport] None of the ${messages.length} recorded messages match the channel filter ` +
                    `"${filter}"; nothing will be replayed.`,
            );
        }

        this.#current_index = 0;
        this.#start_time = Date.now();
        this.#base_timestamp = this.#messages[0]?.timestamp ?? null;
        this.#scheduleNext();
    }

    /**
     * Stop the playback.
     */
    async stop(): Promise<void> {
        this.#stopped = true;
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }

    /**
     * Parse the text of a recording, telling a JSON array from an MQTT trace dump.
     */
    #parse(content: string): Array<PlaybackMessage> {
        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch {
            return this.#parseMqttDump(content);
        }

        if (!Array.isArray(parsed)) {
            throw new Error("A JSON recording must be an array");
        }
        return this.#parseRecords(parsed);
    }

    /**
     * Parse already-decoded records — envelopes, bare payloads, or a mix of both.
     */
    #parseRecords(entries: Array<unknown>): Array<PlaybackMessage> {
        const default_channel = this.#config.default_channel ?? "playback";
        return entries.map(entry => {
            // An envelope carries its own channel; anything else is a bare payload.
            if (entry !== null && typeof entry === "object" && "channel" in entry && "payload" in entry) {
                const envelope = entry as { channel: unknown; payload: unknown; timestamp?: unknown };
                return {
                    channel: typeof envelope.channel === "string" ? envelope.channel : default_channel,
                    payload: envelope.payload,
                    timestamp: parseTimestamp(envelope.timestamp) ?? parseTimestamp(readTimestamp(envelope.payload)),
                };
            }
            return {
                channel: default_channel,
                payload: entry,
                timestamp: parseTimestamp(readTimestamp(entry)),
            };
        });
    }

    /**
     * Parse an MQTT trace dump — lines of `<topic> <json>` — preserving each message's topic as its
     * channel. Malformed lines are skipped.
     */
    #parseMqttDump(content: string): Array<PlaybackMessage> {
        const messages: Array<PlaybackMessage> = [];
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            const space_index = trimmed.indexOf(" ");
            if (space_index === -1) {
                continue;
            }
            const channel = trimmed.slice(0, space_index);
            try {
                const payload = JSON.parse(trimmed.slice(space_index + 1));
                messages.push({ channel, payload, timestamp: parseTimestamp(readTimestamp(payload)) });
            } catch {
                // Skip malformed lines.
            }
        }

        if (messages.length === 0) {
            throw new Error("The recording is neither valid JSON nor a recognised MQTT trace dump");
        }
        return messages;
    }

    /**
     * Emit every message whose recorded time has come, then arm a timer for the next one. Loops
     * back to the start at the end of the sequence unless `loop` is off. Does nothing once stopped.
     *
     * Messages that are due are emitted in the same tick rather than one timer apart: recorded at
     * the same instant, they should be replayed at the same instant, and a timer per message would
     * cap the replay at the host's timer granularity — around 1 kHz in Node, and 250 Hz in a
     * browser, which clamps nested timeouts to 4 ms. That cap would silently slow down a dense
     * recording, and `speed` with it.
     */
    #scheduleNext(): void {
        if (this.#stopped) {
            return;
        }

        let emitted = 0;
        for (;;) {
            if (this.#current_index >= this.#messages.length) {
                // An empty sequence has nothing to loop over; scheduling again would spin.
                if (this.#config.loop === false || this.#messages.length === 0) {
                    return;
                }
                // Loop the recording from the messages already in memory. Re-running `start()` here
                // would re-read and re-parse the source on every lap, and its rejection would be
                // unhandled (fatal under Node's default `--unhandled-rejections=throw`).
                this.#current_index = 0;
                this.#start_time = Date.now();
            }

            const message = this.#messages[this.#current_index];
            const delay = this.#delayFor(message);

            // Yield at the burst cap even when nothing is due yet: a recording carrying no
            // timestamps at all paces off nothing, and would otherwise spin the loop forever.
            if (delay > 0 || emitted >= MAX_MESSAGES_PER_TICK) {
                this.#timer = setTimeout(() => this.#scheduleNext(), delay);
                return;
            }

            // Not awaited on purpose: the sink may be async but must not delay the next message.
            void this.#emit(message);
            this.#current_index++;
            emitted++;
        }
    }

    /**
     * How long to wait before a message is due, from its timestamp relative to the first one and
     * the configured speed. Zero for a recording that carries no usable timestamps.
     */
    #delayFor(message: PlaybackMessage): number {
        if (this.#base_timestamp === null || message.timestamp === null || this.#start_time === null) {
            return 0;
        }
        const speed = this.#config.speed ?? 1;
        return Math.max(0, (message.timestamp - this.#base_timestamp) / speed - (Date.now() - this.#start_time));
    }

    /**
     *
     */
    async #emit(message: PlaybackMessage): Promise<void> {
        try {
            await this.#sink.ingest({
                channel: message.channel,
                payload: message.payload,
                received_at: new Date(),
                ...(message.timestamp !== null ? { source_timestamp: new Date(message.timestamp) } : {}),
            });
        } catch (error) {
            console.error(`[playback-transport] Sink failed:`, error);
        }
    }
}

/**
 * Resolve any {@link PlaybackSource} down to the recording's text, or to the records it already is.
 */
async function readSource(source: PlaybackSource, depth = 0): Promise<string | Array<unknown>> {
    if (typeof source === "function") {
        if (depth >= MAX_SOURCE_INDIRECTIONS) {
            throw new Error(
                `Playback source still resolved to a function after ${MAX_SOURCE_INDIRECTIONS} hops; ` +
                    `it most likely returns itself.`,
            );
        }
        return readSource(await source(), depth + 1);
    }

    if (typeof source === "string") {
        return source;
    }
    if (Array.isArray(source)) {
        return source;
    }
    if (source instanceof Uint8Array) {
        return new TextDecoder().decode(source);
    }
    if (source instanceof ArrayBuffer) {
        return new TextDecoder().decode(new Uint8Array(source));
    }
    if (typeof ReadableStream !== "undefined" && source instanceof ReadableStream) {
        return readStream(source);
    }
    if (Symbol.asyncIterator in source) {
        return readAsyncIterable(source);
    }
    if ("file_path" in source) {
        return readFilePath(source.file_path);
    }
    if ("url" in source) {
        return readUrl(source);
    }

    throw new Error(`Unsupported playback source: ${Object.prototype.toString.call(source)}`);
}

/**
 * Drain a `ReadableStream` into a string. Read through a reader rather than `for await`: async
 * iteration over a `ReadableStream` is still not universal in browsers.
 */
async function readStream(stream: ReadableStream<Uint8Array | string>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let content = "";
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            content += typeof value === "string" ? value : decoder.decode(value, { stream: true });
        }
    } finally {
        reader.releaseLock();
    }
    return content + decoder.decode();
}

/**
 * Drain an async iterable of chunks into a string.
 */
async function readAsyncIterable(iterable: AsyncIterable<Uint8Array | string>): Promise<string> {
    const decoder = new TextDecoder();
    let content = "";
    for await (const chunk of iterable) {
        content += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    }
    return content + decoder.decode();
}

/**
 * Read a recording off the local file system. The only Node.js-only source form.
 */
async function readFilePath(file_path: string): Promise<string> {
    if (!file_path) {
        throw new Error("file_path is required in a { file_path } playback source");
    }
    // The specifier is assembled at runtime so a bundler cannot statically analyse it. Spelled
    // literally, `import("node:fs/promises")` is a hard resolve error for any browser-targeted
    // esbuild consumer of this package (Vite only warns), even though nothing they ship ever
    // reaches this Node-only source form. The type-position import below is erased at compile
    // time, so the module stays fully typed.
    const node_fs_promises = "node:fs" + "/promises";
    const { readFile } = (await import(/* @vite-ignore */ node_fs_promises)) as typeof import("node:fs/promises");
    return readFile(file_path, "utf8");
}

/**
 * Fetch a recording. A failed request throws rather than replaying the error page as a recording.
 */
async function readUrl({ url, init }: { url: string; init?: RequestInit }): Promise<string> {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Failed to fetch playback source "${url}": ${response.status} ${response.statusText}`);
    }
    return response.text();
}

/**
 * The `timestamp` field of a recorded payload, if it has one.
 */
function readTimestamp(payload: unknown): unknown {
    if (payload === null || typeof payload !== "object") {
        return undefined;
    }
    return (payload as { timestamp?: unknown }).timestamp;
}

/**
 * A recorded timestamp as epoch milliseconds, or null if absent or invalid.
 */
function parseTimestamp(timestamp: unknown): number | null {
    if (typeof timestamp !== "string" && typeof timestamp !== "number") {
        return null;
    }
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date.getTime();
}
