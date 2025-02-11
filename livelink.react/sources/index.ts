export * from "./hooks/useEntity";
export * from "./hooks/useClients";
export * from "./hooks/useCameraEntity";

export * from "./components/core/Livelink";
export * from "./components/core/Canvas";
export * from "./components/core/Viewport";
export * from "./components/core/CameraController";
export { CameraController as DefaultCameraController } from "@3dverse/livelink";
export * from "./components/core/WebXR";

export * from "./components/overlays/DOM3DOverlay";
export * from "./components/overlays/DOM3DElement";
export * from "./components/overlays/DOMEntity";

export * from "./overlays/ReactOverlay";
export * from "./overlays/React3DElement";

export * from "./web-xr/WebXRHelper";

export * from "./utils";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink React library, injected by the build system.
 * @internal
 */
declare const LIVELINK_REACT_VERSION: string;

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
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink React ⚛️ being imported.");
    } else {
        window.__LIVELINK__[PACKAGE_NAME] = LIVELINK_REACT_VERSION;
    }
}
