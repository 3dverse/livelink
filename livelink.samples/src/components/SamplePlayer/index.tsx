export * from "./ActionBar";
export * from "./DisconnectedModal";
export * from "./SamplePlayer";

//------------------------------------------------------------------------------
export function resolveSamplePath(path: string): string {
    return path.substring(path.lastIndexOf("/") + 3, path.lastIndexOf("."));
}

//------------------------------------------------------------------------------
export function resolveGitPath(path: string): string {
    return "https://github.com/3dverse/livelink/tree/release/" + path.substring(path.lastIndexOf("livelink.samples/"));
}
