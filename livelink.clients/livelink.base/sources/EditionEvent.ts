import type { Client } from "./session/Client";

/**
 * @noInheritDoc
 * @category Utils
 */
export class EditionEvent extends Event {
    /**
     * The client id that emitted the event.
     */
    public readonly emitter: Client | null;

    /**
     * Returns true if the event was made by the current app.
     */
    isLocal(): boolean {
        return this.emitter === null;
    }

    /**
     * Returns true if the event was made by another user from another instance of the app or even another app.
     */
    isExternal(): boolean {
        return this.emitter !== null;
    }

    /**
     * @internal
     */
    constructor(event_name: string, emitter: Client | null) {
        super(event_name);
        this.emitter = emitter;
    }
}
