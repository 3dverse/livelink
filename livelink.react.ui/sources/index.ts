//------------------------------------------------------------------------------
export * from "./components/Provider";

//------------------------------------------------------------------------------
export * from "./components/InactivityWarning";
export * from "./components/RenderGraphSettings";
export * from "./components/SunPositionPicker";
export * from "./components/LightControl";
export * from "./components/LightControl/LightPreview/LightPreview";
export * from "./components/LightControl/LightColorSelector/LightColorSelector";
export * from "./components/LightControl/LightTemperatureSlider/LightTemperatureSlider";
export * from "./components/LightControl/LightBrightnessSlider/LightBrightnessSlider";
export * from "./components/LightControl/LightSwitchOnOff/LightSwitchOnOff";
export * from "./components/LightControl/LightControlContext";
export * from "./components/ViewCube";
export * from "./components/LoadingOverlay";
export * from "./components/VirtualGamepad";
export * from "./components/VirtualJoystick";

//------------------------------------------------------------------------------
/**
 * Version of the Livelink React UI library, injected by the build system.
 * @internal
 */
declare const LIVELINK_REACT_UI_VERSION: string;

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
        console.warn("⚠️ WARNING ⚠️ Multiple instances of Livelink React UI being imported.");
    } else {
        window.__LIVELINK__[PACKAGE_NAME] = LIVELINK_REACT_UI_VERSION;
    }
}
