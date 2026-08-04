/**
 * Match a channel pattern against an event channel.
 *
 * Patterns use MQTT-style topic wildcards over `/`-separated segments: `+` or `*` matches exactly
 * one segment, a trailing `#` matches the rest. A pattern without wildcards is an exact match.
 *
 * ```
 * matchChannel("uagv/+/visualization", "uagv/23070/visualization")  // true
 * matchChannel("uagv/#", "uagv/23070/state")                        // true
 * matchChannel("file", "file")                                     // true
 * ```
 *
 * @category Data
 */
export function matchChannel(pattern: string, channel: string): boolean {
    if (pattern === channel) {
        return true;
    }
    const pattern_segments = pattern.split("/");
    const channel_segments = channel.split("/");

    for (let i = 0; i < pattern_segments.length; i++) {
        const segment = pattern_segments[i];
        if (segment === "#") {
            return i === pattern_segments.length - 1;
        }
        if (i >= channel_segments.length) {
            return false;
        }
        if (segment !== "+" && segment !== "*" && segment !== channel_segments[i]) {
            return false;
        }
    }
    return pattern_segments.length === channel_segments.length;
}
