/**
 * @category Utils
 */
export class TypedEventTarget<EventMap extends Record<string, Event>> {
    #event_target = new EventTarget();

    /**
     *
     */
    addEventListener<_EventName extends keyof EventMap & string>(
        event_name: _EventName,
        listener: (event: EventMap[_EventName]) => void,
        options?: AddEventListenerOptions | boolean,
    ): void {
        this.#event_target.addEventListener(event_name, listener as EventListener, options);
    }

    /**
     *
     */
    removeEventListener<_EventName extends keyof EventMap & string>(
        event_name: _EventName,
        listener: (event: EventMap[_EventName]) => void,
        options?: EventListenerOptions | boolean,
    ): void {
        this.#event_target.removeEventListener(event_name, listener as EventListener, options);
    }

    /**
     * @internal
     */
    _dispatchEvent<T extends keyof EventMap>(event: EventMap[T]): boolean {
        return this.#event_target.dispatchEvent(event as Event);
    }
}
