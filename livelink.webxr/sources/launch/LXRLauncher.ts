//------------------------------------------------------------------------------
/**
 * Why a WebXR session cannot be entered here, when it cannot.
 *
 * - `insecure-context` — WebXR is gated on a secure context, so the page has to be served over
 *   https (or come from localhost).
 * - `needs-launcher` — the device could run the session through a launcher, but the launcher is
 *   not configured. See {@link LXRVariantLaunchLauncher}, whose SDK key is a required setting.
 * - `no-webxr` — the browser exposes no `navigator.xr` and no launcher covers it. A desktop
 *   browser without a headset, most notably.
 */
export type LXRLaunchUnsupportedReason = "insecure-context" | "needs-launcher" | "no-webxr";

//------------------------------------------------------------------------------
/**
 * What a {@link LXRLauncher} concluded about the current page.
 *
 * `launch-required` is the state that only exists on iOS: the page itself can never run the
 * session, but a companion App Clip can, and it takes the page's own URL as its argument. Acting on
 * it means navigating away — see {@link LXRLaunchState.launch_url}.
 */
export type LXRLaunchState =
    /**
     * The session can be requested from this page, right now. Android, a headset browser, or an
     * iOS App Clip that has already injected its polyfill and re-opened the page.
     */
    | { status: "supported" }
    /**
     * The session cannot run in this page, but navigating to `launch_url` hands it to something
     * that can.
     */
    | {
          status: "launch-required";
          /**
           * Where to send the browser. It encodes the current page URL, so whatever opens it comes
           * back here with WebXR available.
           */
          launch_url: string;
          /**
           * Whether the user has to be in Safari for the launch to do anything.
           *
           * App Clip cards and Smart App Banners render in Safari and `SFSafariViewController`
           * only — Chrome, Firefox and every in-app browser on iOS will simply load `launch_url`
           * as an ordinary page. True here means "we can give you the URL, but tell the user to
           * open it in Safari first".
           */
          needs_safari: boolean;
      }
    /**
     * No path to a session from here.
     */
    | { status: "unsupported"; reason: LXRLaunchUnsupportedReason; message: string };

//------------------------------------------------------------------------------
/**
 * A strategy for reaching a WebXR session on a device whose browser has none of its own.
 *
 * The only platform that needs one is iOS, where Safari exposes no `navigator.xr` at all and the
 * session has to happen inside a native app that injects a polyfill. A launcher's whole job is to
 * answer one question — can this page enter XR, and if not, where do we send the user — without the
 * caller having to know which native app is involved.
 *
 * Implementations must be safe to call off-iOS: a launcher that finds real WebXR support reports
 * {@link LXRLaunchState} `supported` and gets out of the way, so a consumer can wire one in
 * unconditionally rather than branching on the platform itself.
 */
export interface LXRLauncher {
    /**
     * Short identifier, for logs and for telling two configured launchers apart.
     */
    readonly name: string;

    /**
     * Work out how — or whether — this page can reach an XR session of the given mode.
     *
     * @param mode The session mode the caller intends to request.
     * @param signal Aborts a resolution that is waiting on a launcher SDK to load.
     */
    resolve({ mode, signal }: { mode: XRSessionMode; signal?: AbortSignal }): Promise<LXRLaunchState>;
}

//------------------------------------------------------------------------------
/**
 * Whether this is an iOS device, iPadOS included.
 *
 * iPadOS 13 and later report themselves as `MacIntel` with a desktop user agent, so the platform
 * string alone misses every iPad; the touch points are what give it away.
 */
export function isIOS(): boolean {
    if (typeof navigator === "undefined") {
        return false;
    }

    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        return true;
    }

    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

//------------------------------------------------------------------------------
/**
 * Tokens that a non-Safari iOS browser adds to its user agent.
 *
 * Every browser on iOS renders with WebKit, so the engine says nothing about which app is showing
 * the page — only these vendor tokens do. The list covers the third-party browsers and the in-app
 * webviews common enough to be worth naming; anything unlisted is taken for Safari, which fails in
 * the harmless direction (the user is told to launch, and the launch simply does nothing).
 */
const NON_SAFARI_IOS_TOKENS = [
    // Third-party browsers.
    "CriOS", // Chrome
    "FxiOS", // Firefox
    "EdgiOS", // Edge
    "OPiOS", // Opera
    "OPT/", // Opera Touch
    "DuckDuckGo",
    "Brave",
    // In-app webviews.
    "GSA/", // Google app
    "FBAN",
    "FBAV", // Facebook
    "Instagram",
    "Line/",
    "Twitter",
    "LinkedInApp",
];

//------------------------------------------------------------------------------
/**
 * Whether the page is in Safari proper, the only iOS browser that shows an App Clip card.
 *
 * Off iOS this is meaningless and returns false — ask {@link isIOS} first.
 */
export function isSafariOnIOS(): boolean {
    if (!isIOS() || typeof navigator === "undefined") {
        return false;
    }

    const { userAgent } = navigator;
    return !NON_SAFARI_IOS_TOKENS.some(token => userAgent.includes(token));
}

//------------------------------------------------------------------------------
/**
 * Build an `unsupported` state with the stock explanation for a reason.
 *
 * @internal
 */
export function unsupported(reason: LXRLaunchUnsupportedReason, message?: string): LXRLaunchState {
    const default_messages: Record<LXRLaunchUnsupportedReason, string> = {
        "insecure-context": "WebXR requires a secure context (https).",
        "needs-launcher": "No launcher is configured for this device.",
        "no-webxr": "WebXR is not supported by this browser.",
    };

    return { status: "unsupported", reason, message: message ?? default_messages[reason] };
}
