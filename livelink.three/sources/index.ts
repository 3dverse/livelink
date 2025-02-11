export * from "./ThreeOverlay";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink React UI library, injected by the build system.
 * @internal
 */
declare const LIVELINK_THREE_VERSION: string;

//------------------------------------------------------------------------------
declare global {
    interface Window {
        __LIVELINK_THREE__: string;
    }
}

//------------------------------------------------------------------------------
if (typeof window !== "undefined") {
    if (window.__LIVELINK_THREE__) {
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink Three 🌳 being imported.");
    } else {
        window.__LIVELINK_THREE__ = LIVELINK_THREE_VERSION;
    }
}
