export * from "./ActionBar";
export * from "./DisconnectedModal";
export * from "./LoadingOverlay";
export * from "./LoadingOverlay";
export * from "./SamplePlayer";

export function resolveSamplePath(path: string): string {
    return path.substring(path.lastIndexOf("/") + 3, path.lastIndexOf("."));
}
