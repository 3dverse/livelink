//------------------------------------------------------------------------------
// Stand-in for the `node-opcua-client` package, which this repository deliberately does not install
// (see `sources/data/transports/optional-peers.d.ts`). `vitest.config.ts` aliases the module id
// here, so `OpcUaTransport`'s lazy `import("node-opcua-client")` lands on this file and the
// transport can be driven end to end — connect, subscribe, sample, tear down — without a server.
//
// It only implements what the transport's structural view of the module declares.

/**
 * The listeners the transport registers are all single-purpose, so one per event is enough.
 */
class Emitter {
    readonly #listeners = new Map<string, (...args: Array<unknown>) => void>();

    on(event: string, listener: (...args: Array<never>) => void): void {
        this.#listeners.set(event, listener as (...args: Array<unknown>) => void);
    }

    emit(event: string, ...args: Array<unknown>): void {
        this.#listeners.get(event)?.(...args);
    }
}

//------------------------------------------------------------------------------
export type FakeMonitoringParameters = { samplingInterval: number; discardOldest: boolean; queueSize: number };

export class FakeMonitoredItem extends Emitter {
    /** The `MonitoredItemCreateResult`, once the server has answered. */
    result: { revisedSamplingInterval?: number; revisedQueueSize?: number } | null = null;

    constructor(
        readonly node_id: string,
        readonly parameters: FakeMonitoringParameters,
        readonly timestamps_to_return: number,
    ) {
        super();
    }

    /** Deliver one sample to the transport, as a server publication would. */
    publish(data_value: unknown): void {
        this.emit("changed", data_value);
    }

    /** Answer the CreateMonitoredItems request, with the parameters the server settled on. */
    initialize(result: { revisedSamplingInterval?: number; revisedQueueSize?: number } = {}): void {
        this.result = result;
        this.emit("initialized");
    }
}

//------------------------------------------------------------------------------
export class FakeSubscription extends Emitter {
    readonly items: Array<FakeMonitoredItem> = [];
    terminated = false;

    /** The publishing interval the server settled on, known only once it has answered. */
    publishingInterval = 0;

    constructor(readonly options: Record<string, number | boolean>) {
        super();
    }

    async terminate(): Promise<void> {
        this.terminated = true;
    }

    /** Answer the CreateSubscription request, publishing at `interval` whatever was requested. */
    start(interval: number): void {
        this.publishingInterval = interval;
        this.emit("started", 1);
    }
}

//------------------------------------------------------------------------------
export class FakeSession {
    closed = false;

    async close(): Promise<void> {
        this.closed = true;
    }
}

//------------------------------------------------------------------------------
export type FakeClientOptions = {
    applicationName: string;
    endpointMustExist: boolean;
    keepSessionAlive: boolean;
    securityMode: number;
    securityPolicy: string;
    connectionStrategy: { initialDelay: number; maxDelay: number; maxRetry: number };
};

export class FakeClient extends Emitter {
    readonly subscriptions: Array<FakeSubscription> = [];
    endpoint_url: string | null = null;
    user_identity: unknown = undefined;
    session: FakeSession | null = null;
    disconnected = false;

    constructor(readonly options: FakeClientOptions) {
        super();
    }

    async connect(endpoint_url: string): Promise<void> {
        if (fake_opcua.connect_error) {
            throw fake_opcua.connect_error;
        }
        this.endpoint_url = endpoint_url;
    }

    async createSession(user_identity?: unknown): Promise<FakeSession> {
        if (fake_opcua.session_error) {
            throw fake_opcua.session_error;
        }
        this.user_identity = user_identity;
        this.session = new FakeSession();
        return this.session;
    }

    async disconnect(): Promise<void> {
        this.disconnected = true;
    }
}

//------------------------------------------------------------------------------
/**
 * What the test reaches for: everything the transport built, and the failures to inject.
 */
export const fake_opcua = {
    clients: [] as Array<FakeClient>,
    connect_error: null as Error | null,
    session_error: null as Error | null,

    reset(): void {
        this.clients = [];
        this.connect_error = null;
        this.session_error = null;
    },

    get client(): FakeClient {
        const client = this.clients.at(-1);
        if (!client) {
            throw new Error("No OPC UA client was created");
        }
        return client;
    },

    get subscription(): FakeSubscription {
        const subscription = this.client.subscriptions.at(-1);
        if (!subscription) {
            throw new Error("No OPC UA subscription was created");
        }
        return subscription;
    },

    get items(): Array<FakeMonitoredItem> {
        return this.subscription.items;
    },
};

//------------------------------------------------------------------------------
export const OPCUAClient = {
    create(options: FakeClientOptions): FakeClient {
        const client = new FakeClient(options);
        fake_opcua.clients.push(client);
        return client;
    },
};

export const ClientSubscription = {
    create(_session: FakeSession, options: Record<string, number | boolean>): FakeSubscription {
        const subscription = new FakeSubscription(options);
        fake_opcua.client.subscriptions.push(subscription);
        return subscription;
    },
};

export const ClientMonitoredItem = {
    create(
        subscription: FakeSubscription,
        item_to_monitor: { nodeId: string; attributeId: number },
        parameters: FakeMonitoringParameters,
        timestamps_to_return: number,
    ): FakeMonitoredItem {
        const item = new FakeMonitoredItem(item_to_monitor.nodeId, parameters, timestamps_to_return);
        subscription.items.push(item);
        return item;
    },
};
