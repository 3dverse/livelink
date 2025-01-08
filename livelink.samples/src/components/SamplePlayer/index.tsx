export * from "./ActionBar";
export * from "./DisconnectedModal";
export * from "./LoadingSpinner";
export * from "./LoadingOverlay";
export * from "./SamplePlayer";

export const sampleCanvasClassName = "max-h-screen bg-[#1e222e] rounded-xl";

export function resolveSamplePath(path: string): string {
    return path.substring(path.lastIndexOf("/") + 3, path.lastIndexOf("."));
}
