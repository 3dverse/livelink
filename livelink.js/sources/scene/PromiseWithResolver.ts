/**
 * Creates a Promise along with its resolve and reject functions.
 *
 * @internal
 */
export class PromiseWithResolver<T> {
    readonly promise: Promise<T>;
    #resolve!: (value: T) => void;
    #reject!: (reason?: unknown) => void;

    /**
     *
     */
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
    }

    /**
     *
     */
    get resolve(): (value: T) => void {
        return this.#resolve;
    }

    /**
     *
     */
    get reject(): (reason?: unknown) => void {
        return this.#reject;
    }
}
