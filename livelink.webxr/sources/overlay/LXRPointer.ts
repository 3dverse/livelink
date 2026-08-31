//------------------------------------------------------------------------------
import { Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
import { LXRQuad } from "./LXRQuad";
import { LXRTexture } from "./LXRTexture";
import type { LXROverlay } from "./LXROverlay";
import type { LXRPanel, LXRPanelItem, LXRPanelItemPart } from "./LXRPanel";
import type { LXRInputSource } from "../input/LXRInputSource";
import type { LXRActionMap } from "../input/LXRActionMap";
import type { LXRAction } from "../input/LXRStandardActions";

//------------------------------------------------------------------------------
/**
 * How a pointer draws itself.
 */
export type LXRPointerTheme = {
    /**
     * The laser's colour at the near end. It fades out towards the far one.
     */
    laser_color: string;

    /**
     * Thickness of the laser, in metres.
     */
    laser_width_m: number;

    /**
     * How far the laser reaches when it is not on a panel.
     */
    miss_length_m: number;

    /**
     * The cursor's colour.
     */
    cursor_color: string;

    /**
     * Diameter of the cursor as a fraction of how far away it is, so that it keeps the same
     * apparent size on a panel at arm's length and on one across the room.
     */
    cursor_angular_size: number;

    /**
     * Smallest and largest the cursor may be drawn, in metres, so the angular size does not vanish
     * on a panel held right up to the face or swell on a distant one.
     */
    cursor_min_size_m: number;
    cursor_max_size_m: number;
};

//------------------------------------------------------------------------------
/**
 * What a pointer draws with when it is not given anything else.
 */
export const LXR_DEFAULT_POINTER_THEME: Readonly<LXRPointerTheme> = Object.freeze({
    laser_color: "rgb(94, 168, 255)",
    laser_width_m: 0.004,
    miss_length_m: 1.2,
    cursor_color: "rgb(255, 255, 255)",
    cursor_angular_size: 0.018,
    cursor_min_size_m: 0.008,
    cursor_max_size_m: 0.05,
} satisfies LXRPointerTheme);

//------------------------------------------------------------------------------
/**
 * The actions a pointer claims from the action map while it is on a panel.
 *
 * All three are what one physical press means elsewhere: on a controller the trigger raises the
 * session's `select` *and* reports a trigger component, which the default map binds to `rise` on the
 * right hand and `place` on the left. Pressing a button on a panel must not also fly the user
 * upwards, and letting go of it must give the binding straight back — which is what claiming per
 * frame, per source does.
 */
export const LXR_DEFAULT_POINTER_SUPPRESSED_ACTIONS: readonly LXRAction[] = ["select", "rise", "place"];

//------------------------------------------------------------------------------
/**
 * Size of the laser's texture. One thin column: the gradient runs along its length, and there is
 * nothing across it.
 */
const LASER_TEXTURE_WIDTH_PX = 8;
const LASER_TEXTURE_HEIGHT_PX = 128;

//------------------------------------------------------------------------------
/**
 * Size of the cursor's texture.
 */
const CURSOR_TEXTURE_SIZE_PX = 64;

//------------------------------------------------------------------------------
/**
 * Two distances closer than this are the same distance, and the panel drawn on top wins the hover.
 */
const HIT_DISTANCE_EPSILON = 1e-4;

//------------------------------------------------------------------------------
/**
 * One input source aimed at the panels: the ray, what it is on, the press, and the laser and cursor
 * that show the user where they are pointing.
 *
 * Built and driven by {@link LXROverlayManager}, one per source that has a ray to aim with:
 * `tracked-pointer` gets a laser and a cursor, `gaze` a cursor alone — the ray comes from the eyes,
 * and a beam drawn out of them lands as a line down the middle of the view. `screen` and
 * `transient-pointer` get neither: those are a finger on a phone, where the DOM is composited and
 * has already handled the touch.
 *
 * @experimental
 */
export class LXRPointer {
    /**
     * The input source this aims with.
     */
    readonly #source: LXRInputSource;

    /**
     * The overlay the laser and cursor are drawn by.
     */
    readonly #overlay: LXROverlay;

    /**
     * How this draws itself.
     */
    readonly #theme: Readonly<LXRPointerTheme>;

    /**
     * The beam, absent for a `gaze` source.
     */
    readonly #laser: LXRQuad | null;
    readonly #laser_texture: LXRTexture | null;

    /**
     * The dot on the panel.
     */
    readonly #cursor: LXRQuad;
    readonly #cursor_texture: LXRTexture;

    /**
     * What the ray is on this frame.
     */
    #hover_panel: LXRPanel | null = null;
    #hover_item: LXRPanelItem | null = null;
    #hover_part: LXRPanelItemPart = "body";
    #hover_distance: number = 0;

    /**
     * What was under the ray when the press started, which is what a release over the same thing
     * activates.
     */
    #pressed_panel: LXRPanel | null = null;
    #pressed_item: LXRPanelItem | null = null;
    #pressed_part: LXRPanelItemPart = "body";

    /**
     * Scratch, so that a pointer updated every frame allocates nothing.
     */
    readonly #origin = new Vector3();
    readonly #direction = new Vector3();
    readonly #hit_point = new Vector3();
    readonly #right = new Vector3();
    readonly #normal = new Vector3();
    readonly #midpoint = new Vector3();

    /**
     * @param source The input source to aim with.
     * @param overlay The overlay to draw the laser and cursor into.
     * @param theme How to draw them.
     */
    constructor({
        source,
        overlay,
        theme,
    }: {
        source: LXRInputSource;
        overlay: LXROverlay;
        theme?: Partial<LXRPointerTheme>;
    }) {
        this.#source = source;
        this.#overlay = overlay;
        this.#theme = theme ? Object.freeze({ ...LXR_DEFAULT_POINTER_THEME, ...theme }) : LXR_DEFAULT_POINTER_THEME;

        this.#cursor_texture = new LXRTexture({ width: CURSOR_TEXTURE_SIZE_PX, height: CURSOR_TEXTURE_SIZE_PX });
        drawCursorArtwork({ texture: this.#cursor_texture, theme: this.#theme });
        this.#cursor = new LXRQuad({ texture: this.#cursor_texture });
        this.#cursor.visible = false;
        overlay.add(this.#cursor);

        if (source.target_ray_mode === "tracked-pointer") {
            this.#laser_texture = new LXRTexture({ width: LASER_TEXTURE_WIDTH_PX, height: LASER_TEXTURE_HEIGHT_PX });
            drawLaserArtwork({ texture: this.#laser_texture, theme: this.#theme });
            this.#laser = new LXRQuad({ texture: this.#laser_texture });
            this.#laser.visible = false;
            overlay.add(this.#laser);
        } else {
            this.#laser_texture = null;
            this.#laser = null;
        }
    }

    /**
     * The input source this aims with.
     */
    get source(): LXRInputSource {
        return this.#source;
    }

    /**
     * The panel the ray is on, or null when it is on none.
     */
    get hovered_panel(): LXRPanel | null {
        return this.#hover_panel;
    }

    /**
     * The item the ray is on, or null when it is on a panel but not on anything actionable.
     */
    get hovered_item(): LXRPanelItem | null {
        return this.#hover_item;
    }

    /**
     * Which part of {@link hovered_item} the ray is on.
     */
    get hovered_part(): LXRPanelItemPart {
        return this.#hover_part;
    }

    /**
     * Whether an item is being pressed.
     */
    get is_pressed(): boolean {
        return this.#pressed_item !== null;
    }

    /**
     * @internal
     *
     * Aim, hover, press and draw, for one frame.
     *
     * @param panels The panels a ray may land on, already filtered to the visible interactive ones.
     * @param actions The action map to claim the press from.
     * @param suppressed_actions What to claim while on a panel.
     * @param viewer_position Where the viewer is, which is what the laser turns its face towards.
     */
    _update({
        panels,
        actions,
        suppressed_actions,
        viewer_position,
    }: {
        panels: readonly LXRPanel[];
        actions: LXRActionMap;
        suppressed_actions: readonly LXRAction[];
        viewer_position: Vector3 | null;
    }): void {
        const pose = this.#source.target_ray_pose;
        if (!pose) {
            // Tracking loss: a laser left at the last place the hand was is a beam pointing at
            // nothing, and a press resolved against a stale ray would activate the wrong item.
            this.#setHover(null, null, "body", 0);
            this.#pressed_panel = null;
            this.#pressed_item = null;
            this.#hideVisuals();
            return;
        }

        this.#readRay(pose);
        this.#updateHover(panels);
        this.#updatePress();

        if (this.#hover_panel || this.#pressed_item) {
            for (const action of suppressed_actions) {
                actions.consume({ action, source: this.#source });
            }
        }

        this.#updateVisuals({ has_panels: panels.length > 0, viewer_position });
    }

    /**
     * @internal
     *
     * Drop the laser, the cursor and whatever was hovered, for a source that is gone or a session
     * that is ending.
     */
    _release(): void {
        this.#setHover(null, null, "body", 0);
        this.#pressed_panel = null;
        this.#pressed_item = null;

        this.#overlay.remove(this.#cursor);
        this.#cursor_texture.release();

        if (this.#laser && this.#laser_texture) {
            this.#overlay.remove(this.#laser);
            this.#laser_texture.release();
        }
    }

    /**
     * Read this frame's ray out of the target ray pose.
     *
     * @param pose The source's target ray pose.
     */
    #readRay(pose: XRPose): void {
        const { position, matrix } = pose.transform;
        this.#origin.set(position.x, position.y, position.z);
        // A target ray points down `-z` of its own space, as every WebXR space does.
        this.#direction.set(-matrix[8], -matrix[9], -matrix[10]).normalize();
    }

    /**
     * Find the panel this frame's ray is on, and tell the panels involved.
     *
     * @param panels The panels a ray may land on.
     */
    #updateHover(panels: readonly LXRPanel[]): void {
        let best_panel: LXRPanel | null = null;
        let best_item: LXRPanelItem | null = null;
        let best_part: LXRPanelItemPart = "body";
        let best_distance = Infinity;

        for (const panel of panels) {
            const hit = panel.hitTest({ origin: this.#origin, direction: this.#direction });
            if (!hit) {
                continue;
            }

            // Nearest wins, and between two panels at the same distance the one drawn on top does —
            // there is no depth test, so what the user sees in front is what `z_order` says.
            const is_nearer = hit.distance < best_distance - HIT_DISTANCE_EPSILON;
            const is_above =
                Math.abs(hit.distance - best_distance) <= HIT_DISTANCE_EPSILON &&
                best_panel !== null &&
                panel.z_order > best_panel.z_order;
            if (!is_nearer && !is_above) {
                continue;
            }

            best_panel = panel;
            best_item = hit.item;
            best_part = hit.part;
            best_distance = hit.distance;
            this.#hit_point.copy(hit.point);
        }

        this.#setHover(best_panel, best_item, best_part, best_panel ? best_distance : 0);
    }

    /**
     * Record the hover and keep the panels' highlights in step with it.
     *
     * @param panel The panel now under the ray.
     * @param item The item under it.
     * @param part Which part of the item.
     * @param distance How far the panel is.
     */
    #setHover(panel: LXRPanel | null, item: LXRPanelItem | null, part: LXRPanelItemPart, distance: number): void {
        if (this.#hover_panel && this.#hover_panel !== panel) {
            this.#hover_panel._setHighlight({ item_id: null });
        }

        this.#hover_panel = panel;
        this.#hover_item = item;
        this.#hover_part = part;
        this.#hover_distance = distance;

        panel?._setHighlight({
            item_id: item?.id ?? null,
            part,
            is_pressed: this.#pressed_item !== null && this.#pressed_item === item,
        });
    }

    /**
     * Turn this frame's primary-action edge into a press, and a press released over what it started
     * on into an activation.
     */
    #updatePress(): void {
        const edge = this.#source.select_event;

        if (edge === "down") {
            this.#pressed_panel = this.#hover_panel;
            this.#pressed_item = this.#hover_item;
            this.#pressed_part = this.#hover_part;
            this.#hover_panel?._setHighlight({
                item_id: this.#hover_item?.id ?? null,
                part: this.#hover_part,
                is_pressed: this.#pressed_item !== null,
            });
            return;
        }

        if (edge !== "up") {
            return;
        }

        const panel = this.#pressed_panel;
        const item = this.#pressed_item;
        const part = this.#pressed_part;
        this.#pressed_panel = null;
        this.#pressed_item = null;

        panel?._setHighlight({
            item_id: this.#hover_item?.id ?? null,
            part: this.#hover_part,
            is_pressed: false,
        });

        // Released somewhere else than it started, which everywhere else is how a press is taken
        // back rather than committed.
        if (!panel || !item || this.#hover_panel !== panel || this.#hover_item !== item || this.#hover_part !== part) {
            return;
        }

        item.on_activate?.({ panel, item, part });
    }

    /**
     * Place the laser and the cursor for this frame.
     *
     * @param has_panels Whether there is anything to point at at all.
     * @param viewer_position Where the viewer is.
     */
    #updateVisuals({ has_panels, viewer_position }: { has_panels: boolean; viewer_position: Vector3 | null }): void {
        const cursor = this.#cursor;
        const panel = this.#hover_panel;

        if (panel) {
            // Aligned with the panel and drawn just above it: without a depth test, `z_order` is the
            // whole of what puts the cursor in front of what it is on.
            const m = panel.matrix;
            const target = cursor.matrix;
            for (let i = 0; i < 12; i++) {
                target[i] = m[i];
            }
            target[12] = this.#hit_point.x;
            target[13] = this.#hit_point.y;
            target[14] = this.#hit_point.z;
            target[15] = 1;

            const size = Math.min(
                this.#theme.cursor_max_size_m,
                Math.max(this.#theme.cursor_min_size_m, this.#hover_distance * this.#theme.cursor_angular_size),
            );
            cursor.width = size;
            cursor.height = size;
            cursor.z_order = panel.z_order + 1;
            cursor.visible = true;
        } else {
            cursor.visible = false;
        }

        const laser = this.#laser;
        if (!laser) {
            return;
        }

        // Shown as soon as there is a panel in the session, hit or not: a laser that only appears
        // once it is already on the target is of no use in finding one.
        if (!has_panels) {
            laser.visible = false;
            return;
        }

        const length = panel ? this.#hover_distance : this.#theme.miss_length_m;
        this.#midpoint
            .copy(this.#direction)
            .multiplyScalar(length / 2)
            .add(this.#origin);

        if (!this.#orientLaser({ viewer_position })) {
            laser.visible = false;
            return;
        }

        const m = laser.matrix;
        m[0] = this.#right.x;
        m[1] = this.#right.y;
        m[2] = this.#right.z;
        m[3] = 0;
        m[4] = this.#direction.x;
        m[5] = this.#direction.y;
        m[6] = this.#direction.z;
        m[7] = 0;
        m[8] = this.#normal.x;
        m[9] = this.#normal.y;
        m[10] = this.#normal.z;
        m[11] = 0;
        m[12] = this.#midpoint.x;
        m[13] = this.#midpoint.y;
        m[14] = this.#midpoint.z;
        m[15] = 1;

        laser.width = this.#theme.laser_width_m;
        laser.height = length;
        laser.z_order = panel ? panel.z_order - 1 : 0;
        laser.visible = length > 0;
    }

    /**
     * Turn the laser's face towards the viewer, around the ray it is drawn along.
     *
     * A quad seen exactly edge-on is invisible, so the beam is spun about its own axis until it
     * faces whoever is looking at it. That is the whole of what makes a flat quad read as a round
     * beam.
     *
     * @param viewer_position Where the viewer is.
     * @returns Whether an orientation could be built.
     */
    #orientLaser({ viewer_position }: { viewer_position: Vector3 | null }): boolean {
        if (viewer_position) {
            this.#normal.copy(viewer_position).sub(this.#midpoint);
        } else {
            this.#normal.copy(this.#origin).sub(this.#midpoint);
        }

        this.#right.crossVectors(this.#direction, this.#normal);
        if (this.#right.lengthSq() < 1e-8) {
            // Looking straight down the beam. There is nothing to face, and any perpendicular does.
            this.#right.set(1, 0, 0).cross(this.#direction);
            if (this.#right.lengthSq() < 1e-8) {
                this.#right.set(0, 1, 0).cross(this.#direction);
            }
        }

        this.#right.normalize();
        this.#normal.crossVectors(this.#right, this.#direction).normalize();
        return this.#right.lengthSq() > 0 && this.#normal.lengthSq() > 0;
    }

    /**
     * Hide the laser and the cursor, for a frame with no ray.
     */
    #hideVisuals(): void {
        this.#cursor.visible = false;
        if (this.#laser) {
            this.#laser.visible = false;
        }
    }
}

//------------------------------------------------------------------------------
/**
 * Draw the beam: opaque at the near end, gone at the far one, so that it reads as coming out of the
 * hand rather than as a stick floating in the room.
 *
 * The quad's `+y` is the direction it is aimed in and the texture's `v` runs down from it, so the
 * top of the canvas is the far end.
 *
 * @param texture The texture to draw into.
 * @param theme The colour to draw with.
 */
function drawLaserArtwork({ texture, theme }: { texture: LXRTexture; theme: LXRPointerTheme }): void {
    const context = texture.context_2d;
    if (!context) {
        return;
    }

    const { width, height } = texture;
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, theme.laser_color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    texture.markDirty();
}

//------------------------------------------------------------------------------
/**
 * Draw the cursor: a filled dot inside a ring, which stays legible against both a dark panel and a
 * bright one.
 *
 * @param texture The texture to draw into.
 * @param theme The colour to draw with.
 */
function drawCursorArtwork({ texture, theme }: { texture: LXRTexture; theme: LXRPointerTheme }): void {
    const context = texture.context_2d;
    if (!context) {
        return;
    }

    const { width, height } = texture;
    const unit = width / 64;
    const center_x = width / 2;
    const center_y = height / 2;

    context.clearRect(0, 0, width, height);

    context.shadowColor = "rgba(0, 0, 0, 0.55)";
    context.shadowBlur = 3 * unit;

    context.strokeStyle = theme.cursor_color;
    context.globalAlpha = 0.9;
    context.lineWidth = 4 * unit;
    context.beginPath();
    context.arc(center_x, center_y, 24 * unit, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = theme.cursor_color;
    context.beginPath();
    context.arc(center_x, center_y, 10 * unit, 0, Math.PI * 2);
    context.fill();

    texture.markDirty();
}
