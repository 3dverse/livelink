//------------------------------------------------------------------------------
/** Seconds with a decimal under 10 s, e.g. "3.2 s", and as minutes and seconds from a minute, e.g. "1:05". */
export function formatSeconds(seconds: number): string {
    if (seconds < 10) {
        return `${(Math.floor(seconds * 10) / 10).toFixed(1)} s`;
    }
    if (seconds < 60) {
        return `${Math.floor(seconds)} s`;
    }
    const wholeSeconds = Math.floor(seconds);
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}
