class EventEmitter extends EventTarget {
    constructor() {
        super();
    }

    on<T extends EventType>(type: T, listener: (e: CustomEvent<EventTypeToDetailMap[T]>) => void) {
        return this.addEventListener(type, listener as (e: Event) => void);
    }

    off<T extends EventType>(type: T, listener: (e: CustomEvent<EventTypeToDetailMap[T]>) => void) {
        return this.removeEventListener(type, listener as (e: Event) => void);
    }

    emit<T extends EventType>(type: T, event: EventTypeToDetailMap[T]) {
        const e = new CustomEvent(type, { detail: event });
        return this.dispatchEvent(e);
    }
}

type EventType = keyof EventTypeToDetailMap;

type EventTypeToDetailMap = {
    customEvent1: MyEvent;
    customEvent2: Array<string>;
};

class A extends EventEmitter {}

class MyEvent extends CustomEvent<MyEvent> {
    constructor() {
        super("my-event");
    }
}

const a = new A();
a.on("customEvent1", (e: MyEvent) => {});
a.emit("customEvent1", new MyEvent());
