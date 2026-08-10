//------------------------------------------------------------------------------
import { TypedEventTarget } from "@livelink.base/TypedEventTarget";

/**
 * A {@link TypedEventTarget} that knows whether anyone is listening to it.
 *
 * A plain `EventTarget` cannot answer that — `dispatchEvent` returns whether the event was
 * cancelled, not whether it reached anybody — so an emitter with something worth saying when nobody
 * subscribed (an error that would otherwise vanish) has no way to tell. This subclass tracks its own
 * listeners to answer it, and stays out of `livelink.base` because only {@link SceneIngestion} needs
 * the capability.
 *
 * It is not exported from the package root, but it deliberately carries **no** internal-marker tag:
 * this tsconfig sets `stripInternal`, which erases a marked declaration from the emitted `.d.ts`
 * altogether — and since {@link SceneIngestion} extends this class, stripping it would take
 * `addEventListener` and every other inherited member off `SceneIngestion`'s public type with it.
 * (Beware: `stripInternal` scans the comment text, so even naming that tag in prose here triggers
 * it.)
 */
export class ObservedEventTarget<EventMap extends Record<string, Event>> extends TypedEventTarget<EventMap> {
    /**
     * The listeners currently registered, per event name, mapping the listener the caller passed to
     * the function actually registered on the underlying target (they differ for a `once` listener,
     * which is wrapped to keep this bookkeeping honest).
     *
     * Capture is deliberately not part of the identity: the underlying {@link EventTarget} is not in
     * a DOM tree, so nothing ever propagates and the capture flag cannot distinguish two listeners.
     */
    readonly #listeners = new Map<string, Map<unknown, (event: never) => void>>();

    /**
     * Register a listener, remembering it so {@link _hasListeners} can report on it.
     */
    override addEventListener<_EventName extends keyof EventMap & string>(
        event_name: _EventName,
        listener: (event: EventMap[_EventName]) => void,
        options?: AddEventListenerOptions | boolean,
    ): void {
        let registered = this.#listeners.get(event_name);
        if (!registered) {
            registered = new Map();
            this.#listeners.set(event_name, registered);
        }
        // The underlying target ignores a duplicate (name, listener) pair; mirror that here so the
        // tracking cannot double-count.
        if (registered.has(listener)) {
            return;
        }

        // A `once` listener is dropped by the underlying target without going through
        // `removeEventListener`, and an aborted `signal` does the same — both would otherwise leave
        // this map claiming a listener that is gone.
        const once = typeof options === "object" && options.once === true;
        const actual: (event: EventMap[_EventName]) => void = once
            ? (event): void => {
                  this.#untrack(event_name, listener);
                  listener(event);
              }
            : listener;

        if (typeof options === "object" && options.signal) {
            options.signal.addEventListener("abort", () => this.#untrack(event_name, listener), { once: true });
        }

        registered.set(listener, actual as (event: never) => void);
        super.addEventListener(event_name, actual, options);
    }

    /**
     * Remove a listener — the function that was actually registered for it, which for a `once`
     * listener is the wrapper rather than the listener itself.
     */
    override removeEventListener<_EventName extends keyof EventMap & string>(
        event_name: _EventName,
        listener: (event: EventMap[_EventName]) => void,
        options?: EventListenerOptions | boolean,
    ): void {
        const actual = this.#listeners.get(event_name)?.get(listener);
        if (!actual) {
            return;
        }
        this.#untrack(event_name, listener);
        super.removeEventListener(event_name, actual as (event: EventMap[_EventName]) => void, options);
    }

    /**
     * Whether anything is currently listening for an event. Lets an emitter fall back to another
     * channel — a console log for an error nobody observes — instead of dispatching into the void.
     */
    protected _hasListeners<_EventName extends keyof EventMap & string>(event_name: _EventName): boolean {
        return (this.#listeners.get(event_name)?.size ?? 0) > 0;
    }

    /**
     * Drop a listener from the tracking map, without touching the underlying target.
     */
    #untrack(event_name: string, listener: unknown): void {
        const registered = this.#listeners.get(event_name);
        if (!registered) {
            return;
        }
        registered.delete(listener);
        if (registered.size === 0) {
            this.#listeners.delete(event_name);
        }
    }
}
