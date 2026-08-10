//==============================================================================
// The handful of helpers both samples need. Nothing here is specific to either
// transport — reading a payload field, turning an angle into a quaternion, picking a
// segment out of a routing key — which is why it sits beside them rather than in
// either one.
//==============================================================================

import type { Quat } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
/**
 * The `index`-th `/`-separated segment of a channel, or null when the channel has no such segment.
 * A negative index counts back from the end, `-1` being the last segment.
 *
 * Channels are routing keys — an MQTT topic, or the alias an OPC UA node was given — so the entity
 * a mapping addresses is usually spelled out in one of their segments. Count from the end when the
 * topic sits under a prefix whose depth is a deployment decision: `plant/+/+/motor` and
 * `acme/site-3/plant/+/+/motor` then read the same.
 */
export function channelSegment(channel: string, index: number): string | null {
    const segments = channel.split("/");
    return segments[index < 0 ? segments.length + index : index] ?? null;
}

//------------------------------------------------------------------------------
/**
 * A quaternion for a rotation of `yaw` radians about the Y (up) axis.
 */
export function yawQuaternion(yaw: number): Quat {
    return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

//------------------------------------------------------------------------------
/**
 * A quaternion for a rotation of `angle` radians about one of the cardinal axes.
 */
export function axisQuaternion(axis: "x" | "y" | "z", angle: number): Quat {
    const sine = Math.sin(angle / 2);
    const cosine = Math.cos(angle / 2);
    switch (axis) {
        case "x": {
            return [sine, 0, 0, cosine];
        }
        case "y": {
            return [0, sine, 0, cosine];
        }
        case "z": {
            return [0, 0, sine, cosine];
        }
    }
}

//------------------------------------------------------------------------------
/**
 * Read a payload field as a finite number, whatever a source felt like encoding it as. Returns null
 * for anything a component cannot hold, so a mapping can drop the update rather than write a NaN.
 */
export function asNumber(value: unknown): number | null {
    const parsed = typeof value === "string" ? Number(value) : value;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}
