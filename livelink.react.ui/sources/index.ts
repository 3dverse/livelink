export * from "./components/InactivityWarning";
export * from "./components/RenderGraphSettings";
export * from "./components/SunPositionPicker";
export * from "./components/ViewCube";
export * from "./components/LoadingOverlay";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink React UI library, injected by the build system.
 * @internal
 */
declare const LIVELINK_REACT_UI_VERSION: string;

//------------------------------------------------------------------------------
declare global {
    interface Window {
        __LIVELINK_REACT_UI__: string;
    }
}

//------------------------------------------------------------------------------
if (typeof window !== "undefined") {
    if (window.__LIVELINK_REACT_UI__) {
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink React UI being imported.");
    } else {
        window.__LIVELINK_REACT_UI__ = LIVELINK_REACT_UI_VERSION;
    }
}
