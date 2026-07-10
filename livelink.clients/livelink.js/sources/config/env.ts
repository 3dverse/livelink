export const BROWSER_ENV = typeof window !== "undefined" && typeof window.document !== "undefined";
export const NODE_ENV = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
