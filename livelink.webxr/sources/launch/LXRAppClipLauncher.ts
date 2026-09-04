//------------------------------------------------------------------------------
import { LXRSession } from "../LXRSession";
import { isIOS, isSafariOnIOS, unsupported, type LXRLaunchState, type LXRLauncher } from "./LXRLauncher";

//------------------------------------------------------------------------------
/**
 * Reaches WebXR on iOS through an App Clip you host yourself.
 *
 * The clip is a native app — an ARKit session behind a transparent `WKWebView` — that injects a
 * WebXR polyfill and then loads whatever page it was asked for. This class is only the web half of
 * that: it decides that a launch is needed and builds the URL that triggers one. Everything else is
 * Apple configuration, and none of it is code:
 *
 * 1. `https://<domain>/.well-known/apple-app-site-association` must be served as
 *    `application/json`, over a valid certificate, with no redirects, and must name the clip:
 *    `{ "appclips": { "apps": ["<TEAM_ID>.<clip bundle id>"] } }`.
 * 2. The page at `<domain>` must carry the Smart App Banner meta tag, which is what actually
 *    renders the App Clip card:
 *    `<meta name="apple-itunes-app" content="app-id=…, app-clip-bundle-id=…, app-clip-display=card">`.
 * 3. The clip's parent app must be released on the App Store. Until it is, the card does not appear
 *    in Safari at all and the only way in is a TestFlight App Clip Invocation — expected during
 *    bring-up, not a misconfiguration.
 *
 * Unlike {@link LXRVariantLaunchLauncher} there is no SDK to load, no key, and no network round
 * trip: the launch URL is pure string construction, so `resolve` settles as fast as
 * `isSessionSupported` does.
 *
 * @example
 * ```ts
 * const launcher = new LXRAppClipLauncher({ domain: "xr.example.com" });
 * const state = await launcher.resolve({ mode: "immersive-ar" });
 * if (state.status === "launch-required") {
 *     window.location.href = state.launch_url;
 * }
 * ```
 */
export class LXRAppClipLauncher implements LXRLauncher {
    //--------------------------------------------------------------------------
    readonly name = "app-clip";

    //--------------------------------------------------------------------------
    /**
     * Bare domain the clip is associated with — no scheme, no path. It has to match the
     * `appclips:` entry in the clip's `associated-domains` entitlement exactly.
     */
    readonly #domain: string;

    //--------------------------------------------------------------------------
    /**
     * Query parameter the clip reads the target URL back out of.
     */
    readonly #target_url_param: string;

    //--------------------------------------------------------------------------
    /**
     * @param domain Bare domain hosting the App Clip association, e.g. `xr.example.com`. A scheme
     * or a trailing slash is tolerated and stripped, since the same value usually lives in a
     * `.env` next to a full URL.
     * @param targetUrlParam Query parameter carrying the page to open. Must match what the clip
     * parses out of its invocation URL; the reference implementation uses `to`.
     */
    constructor({ domain, targetUrlParam = "to" }: { domain: string; targetUrlParam?: string }) {
        this.#domain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        this.#target_url_param = targetUrlParam;
    }

    //--------------------------------------------------------------------------
    /**
     * The URL that opens `target_url` inside the clip.
     *
     * Exposed separately from {@link resolve} so a landing page or a QR code can be generated for a
     * page other than the current one.
     *
     * @param target_url Page the clip should load. Defaults to the current location.
     */
    public getLaunchUrl(target_url: string = window.location.href): string {
        const url = new URL(`https://${this.#domain}/`);
        url.searchParams.set(this.#target_url_param, target_url);
        return url.toString();
    }

    //--------------------------------------------------------------------------
    /**
     * @inheritdoc
     */
    public async resolve({ mode }: { mode: XRSessionMode; signal?: AbortSignal }): Promise<LXRLaunchState> {
        if (!window.isSecureContext) {
            return unsupported("insecure-context");
        }

        // True inside the clip, whose polyfill has already installed `navigator.xr` — and on every
        // platform that never needed a launcher in the first place.
        if (await LXRSession.isSessionSupported(mode)) {
            return { status: "supported" };
        }

        if (!isIOS()) {
            return unsupported("no-webxr");
        }

        return {
            status: "launch-required",
            launch_url: this.getLaunchUrl(),
            needs_safari: !isSafariOnIOS(),
        };
    }
}
