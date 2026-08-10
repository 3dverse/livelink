/**
 * Base URL of the 3dverse application API.
 *
 * `API_HOSTNAME` is injected at build time by each client SDK's bundler (see the
 * `define` block in the consuming SDK's `esbuild.js`, and `vitest.config.ts` for tests).
 *
 * Mutable so that applications can retarget another environment at runtime through the
 * `Livelink._api_url` accessor exposed by each SDK facade.
 */
let api_url = `https://${API_HOSTNAME}/app/v1`;

/**
 * @internal
 * The current base URL of the 3dverse application API. Read at call time by every API request.
 */
export function getApiUrl(): string {
    return api_url;
}

/**
 * @internal
 * Retarget the 3dverse application API. Must be set before any API call is made.
 */
export function setApiUrl(url: string): void {
    api_url = url;
}
