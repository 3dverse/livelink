//------------------------------------------------------------------------------
import { LXRSession } from "../LXRSession";
import { isSafariOnIOS, unsupported, type LXRLaunchState, type LXRLauncher } from "./LXRLauncher";

//------------------------------------------------------------------------------
/**
 * The slice of the Variant Launch SDK this adapter touches, as installed on `window` by the script
 * loaded from `launchar.app`.
 */
type VLaunchSDK = {
    getLaunchUrl: (url: string) => string;
};

//------------------------------------------------------------------------------
/**
 * Detail carried by the SDK's `vlaunch-initialized` event.
 */
type VLaunchInitializedDetail = {
    /**
     * Whether the SDK concluded the page has to be re-opened inside Variant's App Clip.
     */
    launchRequired?: boolean;
};

//------------------------------------------------------------------------------
/**
 * Reaches WebXR on iOS through Variant Launch's hosted App Clip.
 *
 * This is the path 3dverse shipped first, kept as a fallback while a self-hosted clip
 * ({@link LXRAppClipLauncher}) goes through App Review. It differs from that one in every way that
 * matters operationally: the clip is Variant's App Store listing rather than ours, it needs an SDK
 * key and a paid plan, and resolving takes a script load plus an SDK handshake rather than a string
 * concatenation. Prefer the App Clip launcher once it is live.
 *
 * The two halves are deliberately separate. {@link resolve} answers "can this page enter XR", loads
 * the SDK to find out, and never navigates — it is safe to call on page load. {@link getLaunchUrl}
 * is what acts on a `launch-required` verdict, and it takes the page to open, which is how a
 * consumer carries a session token or a deep link into the clip.
 *
 * @see {@link https://launch.variant3d.com/}
 */
export class LXRVariantLaunchLauncher implements LXRLauncher {
    //--------------------------------------------------------------------------
    readonly name = "variant-launch";

    //--------------------------------------------------------------------------
    readonly #sdk_key: string;
    readonly #sdk_url: string;

    //--------------------------------------------------------------------------
    /**
     * Resolves once the SDK has announced itself, so that two buttons on one page share a single
     * script load and a single handshake instead of racing each other.
     */
    #initialization: Promise<VLaunchInitializedDetail | null> | null = null;

    //--------------------------------------------------------------------------
    /**
     * @param sdkKey Variant Launch project key.
     * @param sdkUrl Override for the SDK endpoint — a pinned version, or a build that behaves
     * differently.
     *
     * The default leaves `redirect=true` off on purpose. That parameter tells the SDK to send iOS
     * visitors to the Launch Card as soon as it initializes, which here means navigating away from
     * inside {@link resolve} — while merely asking whether AR is available, before the user has
     * asked for anything, and before a consumer has had the chance to decide which page the clip
     * should open. `getLaunchUrl` does not depend on it. A consumer that does want the redirect on
     * load can ask for it through this parameter.
     */
    constructor({ sdkKey, sdkUrl }: { sdkKey: string; sdkUrl?: string }) {
        this.#sdk_key = sdkKey;
        this.#sdk_url = sdkUrl ?? `https://launchar.app/sdk/v1?key=${encodeURIComponent(sdkKey)}`;
    }

    //--------------------------------------------------------------------------
    /**
     * The URL that opens `target_url` inside Variant's clip.
     *
     * Exposed separately from {@link resolve} — whose `launch_url` is always this page — because the
     * clip reloads the app from scratch: anything the current page had resolved, a session token or
     * the mode to enter, only survives if it travels in the address. Also what a landing page or a
     * QR code for another page is built from.
     *
     * Meaningful only once {@link resolve} has reported `launch-required`, since the URL is the
     * SDK's to build and that call is what loads the SDK.
     *
     * @param target_url Page the clip should load. Defaults to the current location.
     * @throws If the Variant Launch SDK has not loaded.
     */
    public getLaunchUrl(target_url: string = window.location.href): string {
        const sdk = this.#getSdk();
        if (!sdk) {
            throw new Error(
                "Variant Launch SDK is not available: await resolve() and check for a launch-required state first.",
            );
        }

        return sdk.getLaunchUrl(target_url);
    }

    //--------------------------------------------------------------------------
    /**
     * @inheritdoc
     */
    public async resolve({ mode, signal }: { mode: XRSessionMode; signal?: AbortSignal }): Promise<LXRLaunchState> {
        if (!window.isSecureContext) {
            return unsupported("insecure-context");
        }

        // True inside Variant's clip, whose polyfill has already installed `navigator.xr` — and on
        // every platform that never needed a launcher in the first place.
        if (await LXRSession.isSessionSupported(mode)) {
            return { status: "supported" };
        }

        if (!this.#sdk_key) {
            return unsupported("needs-launcher", "Variant Launch SDK key is not defined.");
        }

        const detail = await this.#initialize(signal);
        if (signal?.aborted) {
            return unsupported("no-webxr");
        }

        if (detail?.launchRequired) {
            if (!this.#getSdk()) {
                return unsupported("needs-launcher", "Variant Launch SDK failed to load.");
            }

            return {
                status: "launch-required",
                launch_url: this.getLaunchUrl(),
                needs_safari: !isSafariOnIOS(),
            };
        }

        // The SDK says no launch is needed. It may have installed a polyfill in the meantime, so
        // the support question has to be asked again rather than answered from the first check.
        if (await LXRSession.isSessionSupported(mode)) {
            return { status: "supported" };
        }

        return unsupported("no-webxr");
    }

    //--------------------------------------------------------------------------
    /**
     * The SDK, once its script has installed itself on `window`. Absent until then, and for good if
     * the script was blocked or the key rejected.
     */
    #getSdk(): VLaunchSDK | undefined {
        return (window as unknown as { VLaunch?: VLaunchSDK }).VLaunch;
    }

    //--------------------------------------------------------------------------
    /**
     * Load the SDK and wait for it to announce itself, at most once per instance.
     *
     * The listener is registered *before* the script is injected. Doing it the other way round —
     * which is how this started life in the sample — races the SDK: `window.VLaunch` is reliably
     * absent right after `onload`, so the code that went looking for it there had to bail and hope
     * a later call found it. Listening first removes the race instead of tolerating it.
     *
     * @returns The event detail, or null if the script failed to load or the wait was aborted.
     */
    #initialize(signal?: AbortSignal): Promise<VLaunchInitializedDetail | null> {
        this.#initialization ??= new Promise<VLaunchInitializedDetail | null>(resolve => {
            const onInitialized = (event: Event): void => {
                resolve((event as CustomEvent<VLaunchInitializedDetail>).detail ?? {});
            };
            window.addEventListener("vlaunch-initialized", onInitialized, { once: true });

            this.#loadScript(this.#sdk_url).catch(error => {
                console.error("Failed to load the Variant Launch SDK", error);
                window.removeEventListener("vlaunch-initialized", onInitialized);
                resolve(null);
            });
        });

        if (!signal) {
            return this.#initialization;
        }

        // A caller that goes away must not be left awaiting an SDK that never announces itself,
        // but the shared initialization itself keeps running for whoever else is waiting on it.
        return Promise.race([
            this.#initialization,
            new Promise<null>(resolve => {
                signal.addEventListener("abort", () => resolve(null), { once: true });
            }),
        ]);
    }

    //--------------------------------------------------------------------------
    /**
     * Inject a script tag once, resolving when it has loaded.
     */
    #loadScript(url: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.onload = (): void => resolve();
            script.onerror = (): void => reject(new Error(`Failed to load ${url}`));
            document.body.appendChild(script);
        });
    }
}
