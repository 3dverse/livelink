// Main WebXR classes
export * from "./XRLivelink";
export * from "./LXREvents";

// Manager classes (for advanced usage)
export * from "./LXRSession";
export * from "./LXRSurface";
export * from "./LXRCameraRig";
export * from "./LXRViewport";
export * from "./LXRContext";
export * from "./LXRFrameLoop";
export * from "./LXRContextPassthrough";
export * from "./LXRLocomotion";
export * from "./LXRLocomotionController";
export * from "./LXRScaling";
export * from "./LXRComfort";

// Anchoring
export * from "./anchor/LXRHitTest";
export * from "./anchor/LXRAnchorTracker";
export * from "./anchor/LXRPlacement";

// Overlay
export * from "./overlay/LXRTexture";
export * from "./overlay/LXRQuad";
export * from "./overlay/LXROverlay";
export * from "./overlay/LXRPanel";
export * from "./overlay/LXRPointer";
export * from "./overlay/LXROverlayManager";

// Input
export * from "./input/LXRInputSource";
export * from "./input/LXRInputProfiles";
export * from "./input/LXRInputManager";
export * from "./input/LXRStandardActions";
export * from "./input/LXRActionMap";

// React integration
export * from "./react";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink WebXR library, injected by the build system.
 * @internal
 */
declare const LIVELINK_WEBXR_VERSION: string;

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
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink WebXR being imported.");
    } else {
        window.__LIVELINK__[PACKAGE_NAME] = LIVELINK_WEBXR_VERSION;
    }
}
