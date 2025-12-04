export * from "./ActionBar";
export * from "./DisconnectedModal";
export * from "./SamplePlayer";

//------------------------------------------------------------------------------
export function resolveSamplePath(path: string): string {
    const dir = path.substring(0, path.lastIndexOf("/index.tsx"));
    return dir.substring(dir.lastIndexOf("/") + 3, path.length - 1);
}

//------------------------------------------------------------------------------
export function resolveGitPath(path: string): string {
    const relPath = path.substring(path.lastIndexOf("livelink.samples/"));
    return "https://github.com/3dverse/livelink/tree/release/" + relPath;
}
