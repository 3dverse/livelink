// Declare globals that may or may not exist depending on environment
declare const process: unknown;
declare const window: unknown;

export const BROWSER_ENV =
    typeof window !== "undefined" && typeof (window as { document?: unknown }).document !== "undefined";
export const NODE_ENV =
    typeof process !== "undefined" &&
    (process as { versions?: { node?: string } }).versions != null &&
    (process as { versions: { node?: string } }).versions.node != null;
