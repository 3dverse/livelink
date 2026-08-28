/**
 * Neutralizes a `throw` from a WebSocket `onerror` handler under Node.
 *
 * `livelink.core`'s `GatewayConnection.connect` installs `socket.onerror = () => { throw new
 * Error("Gateway socket error") }`. A throw from an event listener reaches no caller: under Node it
 * escapes undici's dispatch as an `uncaughtException`, with a stack whose top frame is the whole
 * base64 `data:` module the core is evaluated from. It also says nothing new — `close` always
 * follows `error`, and the core turns that into a `forcibly_closed` disconnect the agent handles.
 *
 * Remove this once the core no longer throws.
 */

//------------------------------------------------------------------------------
type ErrorHandler = ((this: WebSocket, event: Event) => unknown) | null;

//------------------------------------------------------------------------------
let installed = false;

/**
 * Wraps the global `WebSocket` so that an exception thrown out of an `onerror` handler is logged
 * instead of crashing the process. Handlers that don't throw are unaffected.
 *
 * No-op outside Node, and idempotent.
 */
export function installGatewaySocketGuard(): void {
    const is_node = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    if (installed || !is_node || typeof globalThis.WebSocket !== "function") {
        return;
    }

    installed = true;
    const NativeWebSocket = globalThis.WebSocket;

    class GuardedWebSocket extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);

            let handler: ErrorHandler = null;
            let wrapped: ((event: Event) => void) | null = null;

            Object.defineProperty(this, "onerror", {
                configurable: true,
                enumerable: true,
                get: (): ErrorHandler => handler,
                set: (new_handler: ErrorHandler): void => {
                    if (wrapped) {
                        this.removeEventListener("error", wrapped);
                        wrapped = null;
                    }

                    handler = typeof new_handler === "function" ? new_handler : null;

                    if (handler) {
                        const callee = handler;
                        wrapped = (event: Event): void => {
                            try {
                                callee.call(this, event);
                            } catch (error) {
                                // The message only: the stack of a handler living in the core is
                                // rooted in the base64 `data:` module, which is what makes the
                                // uncaught version unreadable in the first place.
                                const message = error instanceof Error ? error.message : String(error);
                                console.warn(`[livelink.agent] suppressed error thrown from onerror: ${message}`);
                            }
                        };
                        this.addEventListener("error", wrapped);
                    }
                },
            });
        }
    }

    globalThis.WebSocket = GuardedWebSocket;
}
