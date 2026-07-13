//------------------------------------------------------------------------------
import type { SceneInfo } from "@3dverse/livelink";

//------------------------------------------------------------------------------
// km/h, fixed regardless of scene size
const WALK_SPEEDS = [1, 2, 3, 4, 5];
// fixed count above the walk speeds — total array length is always 12
const FAST_STEPS = 7;

// target time to cross the full scene diagonal at top fast speed
const TRAVERSAL_SECONDS = 20;
// km/h floor, so "fast" always beats the 5 km/h walk cap even in tiny scenes
const MIN_FAST_MAX_SPEED = 15;

//------------------------------------------------------------------------------
export function computeDiagonalKm(aabb: SceneInfo["aabb"]): number {
    const dx = aabb.max[0] - aabb.min[0];
    const dy = aabb.max[1] - aabb.min[1];
    const dz = aabb.max[2] - aabb.min[2];
    // meters -> km
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / 1000;
}

//------------------------------------------------------------------------------
function roundToNiceSpeed(raw: number): number {
    if (raw <= 100) {
        // 10, 20, 30, ..., 100
        return Math.round(raw / 10) * 10;
    }
    if (raw <= 1000) {
        // 125, 150, ..., 1000
        return Math.round(raw / 25) * 25;
    }
    if (raw <= 10000) {
        // 1100, 1200, ..., 10000
        return Math.round(raw / 100) * 100;
    }
    // continue the same 2-significant-digit pattern
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
    return Math.round(raw / magnitude) * magnitude;
}

//------------------------------------------------------------------------------
export function generateSpeeds(diagonalKm: number): number[] {
    const maxFastSpeed = Math.max(MIN_FAST_MAX_SPEED, (diagonalKm * 3600) / TRAVERSAL_SECONDS);

    // 10 — one clear step above walking
    const firstFast = WALK_SPEEDS[WALK_SPEEDS.length - 1] * 2;
    const ratio = Math.pow(maxFastSpeed / firstFast, 1 / (FAST_STEPS - 1));

    const fastSpeeds: number[] = [];
    let previous = 0;
    for (let i = 0; i < FAST_STEPS; i++) {
        const raw = firstFast * Math.pow(ratio, i);
        // stay strictly increasing after rounding
        const value = Math.max(roundToNiceSpeed(raw), previous + 1);
        fastSpeeds.push(value);
        previous = value;
    }

    return [...WALK_SPEEDS, ...fastSpeeds];
}

//------------------------------------------------------------------------------
// km/h, top speed of the original fixed slider
const REFERENCE_MAX_SPEED = 40;
const REFERENCE_DIAGONAL_KM = (REFERENCE_MAX_SPEED * TRAVERSAL_SECONDS) / 3600;

// fallback while scene info is pending
export const DEFAULT_SPEEDS = generateSpeeds(REFERENCE_DIAGONAL_KM);
