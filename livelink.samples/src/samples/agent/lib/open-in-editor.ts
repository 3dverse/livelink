//==============================================================================
// Opens a running session straight in the 3dverse editor, so the terminal running
// one of these samples doubles as the thing that shows you the scene, instead of
// leaving you to open a viewer and find the session yourself.
//==============================================================================

import { spawn } from "node:child_process";

//------------------------------------------------------------------------------
/**
 * Fetches a guest token for `session_id` and opens the 3dverse editor on it in the
 * default browser. Best-effort: any failure (network, API, no browser to open) is
 * logged and swallowed rather than thrown, since this is a convenience on top of
 * the agent driving the scene, not something that should ever take it down.
 */
export async function openSessionInEditor({
    environment_id,
    scene_id,
    session_id,
    token,
}: {
    environment_id: string;
    scene_id: string;
    session_id: string;
    token: string;
}): Promise<void> {
    try {
        openBrowser(
            `https://console.3dverse.com/app-launcher/session/join/default/${environment_id}/${scene_id}/${session_id}/?token=${token}`,
        );
    } catch (error) {
        console.warn(`[open-in-editor] Could not open the editor automatically (${error}).`);
    }
}

//------------------------------------------------------------------------------
/**
 * Opens `url` in the OS's default browser. Spawns the platform's opener directly
 * (no shell), so there is no quoting/injection concern in building the command
 * from a URL.
 */
function openBrowser(url: string): void {
    const [command, args] = openerCommand(url);
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
        console.warn(`[open-in-editor] Could not open a browser automatically. Open this URL manually: ${url}`);
    });
    child.unref();
}

//------------------------------------------------------------------------------
function openerCommand(url: string): [string, Array<string>] {
    if (process.platform === "win32") {
        return ["cmd", ["/c", "start", "", url]];
    } else if (process.platform === "darwin") {
        return ["open", [url]];
    } else {
        return ["xdg-open", [url]];
    }
}
