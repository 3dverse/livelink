export * from "./ThreeOverlay";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink React UI library, injected by the build system.
 * @internal
 */
declare const LIVELINK_THREE_VERSION: string;

/**
 * Name of the package, injected by the build system.
 * @internal
 */
declare const PACKAGE_NAME: string;

//------------------------------------------------------------------------------
declare global {
    interface Window {
        __LIVELINK__: Record<string, string>;
    }
}
//------------------------------------------------------------------------------
if (typeof window !== "undefined") {
    if (!window.__LIVELINK__) {
        window.__LIVELINK__ = {};
    }

    if (Object.prototype.hasOwnProperty.call(window.__LIVELINK__, PACKAGE_NAME)) {
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink Three being imported.");
    } else {
        window.__LIVELINK__[PACKAGE_NAME] = LIVELINK_THREE_VERSION;
    }
}
