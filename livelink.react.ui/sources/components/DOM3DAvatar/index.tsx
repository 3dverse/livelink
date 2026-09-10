//------------------------------------------------------------------------------
import React, { PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

//------------------------------------------------------------------------------
import type { Client, Entity, Quat, Vec3 } from "@3dverse/livelink";
import { DOM3DDiv, DOM3DEntityAnchor, ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
/**
 * Pixels past the true viewport edge a client's camera is still allowed to project to before its
 * avatar switches to the offscreen indicator. The switch is based on the projected *center point*
 * of the avatar, not its visible extent, so at `0` it swaps the moment the center crosses the
 * edge. Raise this to delay the switch; lower it (or go negative) to switch earlier.
 */
const AVATAR_ONSCREEN_MARGIN = 0;

/** Gap (px) between the viewport edge and the near edge of the offscreen indicator. */
const OFFSCREEN_INDICATOR_EDGE_GAP = 0;

/** Thickness (px) of the offscreen indicator along the axis it hugs the edge on. */
const OFFSCREEN_INDICATOR_THICKNESS = 8;

/** Length (px) of the offscreen indicator along the edge it hugs. */
const OFFSCREEN_INDICATOR_LENGTH = 28;

/** Extra invisible padding (px) around the offscreen indicator, so it stays easy to click despite being flat. */
const OFFSCREEN_INDICATOR_HIT_PADDING = 10;

/**
 * Below this distance (world units) to the target, the direction from the local camera is too
 * short to be meaningful (e.g. right after traveling to sit at the target's own position) — treat
 * it as on-screen instead of clamping to some arbitrary edge.
 */
const OFFSCREEN_INDICATOR_MIN_DISTANCE = 0.5;

/**
 * Below this fraction of the distance to the target, the target's lateral/vertical offset from the
 * camera's forward axis is too small to reliably pick an edge to clamp to — floating-point rotation
 * error alone is enough to push it a hair to either side, which would otherwise flip the indicator
 * between edges from frame to frame. Below this threshold, both `dirX` and `dirY` are treated as 0,
 * so the "camera looking straight at (or away from) the target" fallback below kicks in.
 */
const OFFSCREEN_INDICATOR_AXIS_EPSILON_RATIO = 1e-4;

/** Distance (world units) in front of the client's camera at which its viewport rectangle is drawn. */
const VIEWPORT_RECT_DISTANCE = 0.5;

/** Fallback aspect ratio when the local viewport isn't available yet. */
const DEFAULT_ASPECT_RATIO = 16 / 9;

/**
 * Distances (world units) to the local camera over which the viewport rectangle fades out: fully
 * opaque at/beyond `_START`, fully transparent at/within `_END`. Keeps the rectangle from filling
 * the screen once the local camera has traveled right up to a client.
 */
const VIEWPORT_RECT_FADE_START_DISTANCE = 1.5;
const VIEWPORT_RECT_FADE_END_DISTANCE = 0.8;

//------------------------------------------------------------------------------
/**
 * Screen-space position of the offscreen indicator, clamped to the viewport edge. `orientation` is
 * "vertical" when it's clamped against the left/right edge (drawn as a tall, narrow bar),
 * "horizontal" when it's clamped against the top/bottom edge (drawn as a wide, short bar).
 */
type OffscreenIndicatorState = {
    x: number;
    y: number;
    orientation: "vertical" | "horizontal";
};

//------------------------------------------------------------------------------
export type DOM3DAvatarProps = PropsWithChildren<{
    /**
     * The client this avatar represents.
     */
    client: Client;

    /**
     * The client's camera entity, e.g. the first entity resolved by `client.getCameraEntities()`.
     */
    entity: Entity | null;

    /**
     * Passed through to the internal `DOM3DEntityAnchor`.
     */
    scaleFactor?: number;

    /**
     * Color for the default avatar bubble, the viewport rectangle, and the offscreen indicator.
     * Defaults to a color derived from `client.id`, stable across renders.
     */
    color?: string;

    /**
     * Label shown in the default avatar bubble. Defaults to the first character of `client.id`;
     * pass something more meaningful (e.g. a per-session connection-order letter) when several
     * avatars need to be told apart at a glance.
     */
    label?: string;

    /**
     * Draws a rectangle in 3D space showing the size, position and orientation of the client's
     * camera viewport.
     */
    showViewportRectangle?: boolean;

    /**
     * Shows an edge indicator, clamped to the local viewport's bounds, when the client's camera is
     * off-screen or behind the local camera.
     */
    showOffscreenIndicator?: boolean;

    /**
     * Called when the avatar, or its offscreen indicator, is clicked.
     */
    onTravel?: (entity: Entity) => void;

    className?: string;
    style?: React.CSSProperties;
}>;

/**
 * Renders a client's camera as a billboard avatar anchored to its position in 3D space, with an
 * optional viewport-rectangle overlay and an edge indicator for when the client's camera goes
 * off-screen or behind the local camera. Must be rendered inside `DOM3DOverlay`.
 *
 * @category Components
 *
 * @example
 * ```tsx
 * <DOM3DOverlay>
 *     <DOM3DAvatar
 *         client={client}
 *         entity={clientCameraEntity}
 *         scaleFactor={0.0025}
 *         showViewportRectangle
 *         showOffscreenIndicator
 *         onTravel={entity => cameraController.setLookAt(...)}
 *     />
 * </DOM3DOverlay>
 * ```
 */
export function DOM3DAvatar({
    client,
    entity,
    scaleFactor,
    color,
    label,
    showViewportRectangle = false,
    showOffscreenIndicator = false,
    onTravel,
    className,
    style,
    children,
}: DOM3DAvatarProps): React.JSX.Element | null {
    const { viewport } = useContext(ViewportContext);
    const [offscreen, setOffscreen] = useState<OffscreenIndicatorState | null>(null);
    const [rectOpacity, setRectOpacity] = useState(1);

    const resolvedColor = color ?? defaultColorForClient(client);
    const resolvedLabel = label ?? client.id.charAt(0).toUpperCase();

    // Fires every rendered frame (driven by the overlay), so it also reacts to the local camera
    // moving even when the client's own camera stays still. It keeps firing even while `entity`
    // is behind the local camera: unlike `DOM3DEntityAnchor`'s children, which unmount in that
    // case, this callback lives on the anchor's own props and isn't gated on its render output —
    // which is what lets the offscreen indicator below still track a client who's behind you.
    const handleProjectionChange = useCallback(
        (projection: { screen_position: Vec3; is_visible: boolean }) => {
            const camera = viewport?.camera_projection;
            if (!viewport || !camera || !entity) {
                return;
            }

            const toTarget = subVec3(entity.global_transform.position as Vec3, camera.world_position as Vec3);
            // A target behind the camera can still project inside the viewport bounds (the
            // perspective divide mirrors it), so `screen_position` alone isn't enough — it must
            // also be in front of the camera to count as on-screen.
            const forward = rotateVecByQuat([0, 0, -1], camera.world_orientation as Quat);
            const isInFrontOfCamera = dotVec3(toTarget, forward) > 0;

            const [screenX, screenY] = projection.screen_position;
            const isOnScreen =
                isInFrontOfCamera &&
                projection.is_visible &&
                screenX >= -AVATAR_ONSCREEN_MARGIN &&
                screenX <= viewport.width + AVATAR_ONSCREEN_MARGIN &&
                screenY >= -AVATAR_ONSCREEN_MARGIN &&
                screenY <= viewport.height + AVATAR_ONSCREEN_MARGIN;

            if (showViewportRectangle) {
                const distanceToLocalCamera = Math.hypot(...toTarget);
                setRectOpacity(
                    normalize(
                        distanceToLocalCamera,
                        VIEWPORT_RECT_FADE_END_DISTANCE,
                        VIEWPORT_RECT_FADE_START_DISTANCE,
                    ),
                );
            }

            if (!showOffscreenIndicator) {
                return;
            }

            if (isOnScreen) {
                setOffscreen(previous => (previous === null ? previous : null));
                return;
            }

            setOffscreen(
                computeOffscreenIndicatorState({
                    cameraPosition: camera.world_position as Vec3,
                    cameraOrientation: camera.world_orientation as Quat,
                    targetPosition: entity.global_transform.position as Vec3,
                    viewportWidth: viewport.width,
                    viewportHeight: viewport.height,
                }),
            );
        },
        [viewport, entity, showViewportRectangle, showOffscreenIndicator],
    );

    if (!entity) {
        return null;
    }

    return (
        <>
            {showViewportRectangle && (
                <ClientViewportRect entity={entity} color={resolvedColor} opacity={rectOpacity} />
            )}
            <DOM3DEntityAnchor entity={entity} scaleFactor={scaleFactor} onProjectionChange={handleProjectionChange}>
                {/* Hidden while offscreen: the anchor only knows the target is in front of the camera,
                    not whether it's within the viewport's bounds, so without this it keeps rendering the
                    full avatar right on top of the offscreen indicator. */}
                {!offscreen && (
                    <button
                        type="button"
                        title={resolvedLabel}
                        onClick={() => onTravel?.(entity)}
                        className={[styles.avatar, "livelink-react-ui-component", className].filter(Boolean).join(" ")}
                        style={{ ...style, ["--color" as string]: resolvedColor } as React.CSSProperties}
                    >
                        {children ?? resolvedLabel}
                    </button>
                )}
            </DOM3DEntityAnchor>
            {offscreen && (
                <OffscreenIndicator
                    label={resolvedLabel}
                    state={offscreen}
                    color={resolvedColor}
                    onClick={() => onTravel?.(entity)}
                />
            )}
        </>
    );
}

//------------------------------------------------------------------------------
/** Deterministically hashes a string into a 32-bit integer, used to derive a default per-client color. */
function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

/** Default avatar color for a client, derived from its connection id so it stays stable across renders. */
function defaultColorForClient(client: Client): string {
    const hue = Math.abs(hashString(client.id)) % 360;
    return `hsl(${hue}, 65%, 45%)`;
}

//------------------------------------------------------------------------------
/**
 * Computes where to draw the flat, edge-clamped indicator for a client whose camera is off-screen
 * (outside the viewport bounds) or behind the local camera. Returns `null` when the target is
 * effectively at the camera's own position (see `OFFSCREEN_INDICATOR_MIN_DISTANCE`), in which case
 * there's nothing sensible to clamp.
 *
 * The clamp direction is derived from world-space dot products against the camera's right/up axes
 * rather than from the projected screen position: a target behind the camera projects to a
 * mirrored (sign-flipped) screen position due to the perspective divide, which would clamp it to
 * the wrong edge.
 */
function computeOffscreenIndicatorState({
    cameraPosition,
    cameraOrientation,
    targetPosition,
    viewportWidth,
    viewportHeight,
}: {
    cameraPosition: Vec3;
    cameraOrientation: Quat;
    targetPosition: Vec3;
    viewportWidth: number;
    viewportHeight: number;
}): OffscreenIndicatorState | null {
    const toTarget = subVec3(targetPosition, cameraPosition);
    const distance = Math.hypot(...toTarget);
    if (distance < OFFSCREEN_INDICATOR_MIN_DISTANCE) {
        return null;
    }

    const right = rotateVecByQuat([1, 0, 0], cameraOrientation);
    const up = rotateVecByQuat([0, 1, 0], cameraOrientation);

    let dirX = dotVec3(toTarget, right);
    let dirY = -dotVec3(toTarget, up); // screen Y grows downward, camera "up" points the other way

    // When the target sits (near enough) on the camera's forward axis — dead ahead or straight
    // behind — both dot products collapse toward 0 rather than landing on it exactly, since
    // `right`/`up` are the result of rotating by a floating-point quaternion. Left as-is, that
    // near-zero (but nonzero) pair still runs through the `scaleToEdge` math below and clamps to a
    // point barely off the viewport *center* instead of an edge — this is what the epsilon check
    // guards against, falling back to a fixed edge (top) instead.
    const axisEpsilon = distance * OFFSCREEN_INDICATOR_AXIS_EPSILON_RATIO;
    if (Math.abs(dirX) < axisEpsilon && Math.abs(dirY) < axisEpsilon) {
        dirX = 0;
        dirY = -1;
    }

    const inset = OFFSCREEN_INDICATOR_EDGE_GAP + OFFSCREEN_INDICATOR_THICKNESS / 2;
    const halfWidth = viewportWidth / 2 - inset;
    const halfHeight = viewportHeight / 2 - inset;
    const normalizedX = Math.abs(dirX) / halfWidth;
    const normalizedY = Math.abs(dirY) / halfHeight;
    const scaleToEdge = 1 / Math.max(normalizedX, normalizedY, 1e-6);

    return {
        x: viewportWidth / 2 + dirX * scaleToEdge,
        y: viewportHeight / 2 + dirY * scaleToEdge,
        // Whichever axis is further past its bound is the edge we clamped against: the left/right
        // edge (normalizedX dominant) calls for a tall, narrow bar; the top/bottom edge
        // (normalizedY dominant) calls for a wide, short one.
        orientation: normalizedX >= normalizedY ? "vertical" : "horizontal",
    };
}

//------------------------------------------------------------------------------
/**
 * Flat edge indicator shown in place of the full avatar once a client's camera has left the
 * viewport bounds (or gone behind it): a thin bar hugging whichever edge it was clamped against,
 * padded with an invisible hit area so it stays easy to click despite being visually thin.
 */
function OffscreenIndicator({
    label,
    state,
    color,
    onClick,
}: {
    label: string;
    state: OffscreenIndicatorState;
    color: string;
    onClick?: () => void;
}): React.JSX.Element {
    const width = state.orientation === "vertical" ? OFFSCREEN_INDICATOR_THICKNESS : OFFSCREEN_INDICATOR_LENGTH;
    const height = state.orientation === "vertical" ? OFFSCREEN_INDICATOR_LENGTH : OFFSCREEN_INDICATOR_THICKNESS;

    return (
        <button
            type="button"
            title={label}
            onClick={onClick}
            className={[styles.offscreenIndicatorHitArea, "livelink-react-ui-component"].join(" ")}
            style={{
                left: state.x,
                top: state.y,
                padding: OFFSCREEN_INDICATOR_HIT_PADDING,
            }}
        >
            <span className={styles.offscreenIndicator} style={{ width, height, backgroundColor: color }} />
        </button>
    );
}

//------------------------------------------------------------------------------
/** A rectangle in 3D space showing the size, position and orientation of a client's camera viewport. */
function ClientViewportRect({
    entity,
    color,
    opacity,
}: {
    entity: Entity;
    color: string;
    opacity: number;
}): React.JSX.Element {
    // Track the camera's live transform the same way `DOM3DEntityAnchor` does: `on-entity-updated`
    // fires for remote clients' cameras regardless of which component changed, unlike `useEntity`'s
    // dirty-component filter, which never matches for entities driven by another client.
    //
    // `global_transform.position`/`.orientation` are the SAME array reference on every access
    // (mutated in place as frames arrive), so they must be cloned before going into state —
    // otherwise React sees an identical reference and skips the re-render.
    const [position, setPosition] = useState<Vec3>(() => [...entity.global_transform.position] as Vec3);
    const [orientation, setOrientation] = useState<Quat>(() => [...entity.global_transform.orientation] as Quat);

    useEffect(() => {
        const updateTransform = (): void => {
            setPosition([...entity.global_transform.position] as Vec3);
            setOrientation([...entity.global_transform.orientation] as Quat);
        };

        updateTransform();
        entity.addEventListener("on-entity-updated", updateTransform);
        return (): void => {
            entity.removeEventListener("on-entity-updated", updateTransform);
        };
    }, [entity]);

    // No per-client viewport size is available from the SDK, so approximate it with the local
    // viewport's own aspect ratio.
    const { viewport } = useContext(ViewportContext);
    const aspectRatio = viewport?.aspect_ratio ?? DEFAULT_ASPECT_RATIO;
    const fovyDeg = entity.perspective_lens?.fovy ?? 60;

    const worldQuad = useMemo(() => {
        const forward = rotateVecByQuat([0, 0, -1], orientation);
        const up = rotateVecByQuat([0, 1, 0], orientation);
        const right = rotateVecByQuat([1, 0, 0], orientation);

        const halfHeight = VIEWPORT_RECT_DISTANCE * Math.tan((fovyDeg * Math.PI) / 360);
        const halfWidth = halfHeight * aspectRatio;

        const center = addVec3(position, scaleVec3(forward, VIEWPORT_RECT_DISTANCE));
        const upOffset = scaleVec3(up, halfHeight);
        const rightOffset = scaleVec3(right, halfWidth);

        return {
            tl: addVec3(subVec3(center, rightOffset), upOffset),
            tr: addVec3(addVec3(center, rightOffset), upOffset),
            br: subVec3(addVec3(center, rightOffset), upOffset),
            bl: subVec3(subVec3(center, rightOffset), upOffset),
        };
    }, [position, orientation, aspectRatio, fovyDeg]);

    return (
        <DOM3DDiv
            worldQuad={worldQuad}
            className={styles.viewportRect}
            style={{ ["--color" as string]: color, opacity } as React.CSSProperties}
        />
    );
}

//------------------------------------------------------------------------------
function addVec3(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subVec3(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec3(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s];
}

function dotVec3(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Maps `value` from the [from, to] range to [0, 1], clamped. `from` may be greater than `to`. */
function normalize(value: number, from: number, to: number): number {
    return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** Rotate `v` by unit quaternion `q` (local → world). */
function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
    const ix = q[0];
    const iy = q[1];
    const iz = q[2];
    const iw = q[3];

    const tx = 2 * (iy * v[2] - iz * v[1]);
    const ty = 2 * (iz * v[0] - ix * v[2]);
    const tz = 2 * (ix * v[1] - iy * v[0]);

    return [
        v[0] + iw * tx + iy * tz - iz * ty,
        v[1] + iw * ty + iz * tx - ix * tz,
        v[2] + iw * tz + ix * ty - iy * tx,
    ];
}
