//------------------------------------------------------------------------------
import { Matrix4, Quaternion, Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
import { LXRQuad } from "./LXRQuad";
import { LXRTexture } from "./LXRTexture";
import type { LXRInputManager } from "../input/LXRInputManager";

//------------------------------------------------------------------------------
/**
 * What one panel item is.
 *
 * - `button` — does something when pressed.
 * - `toggle` — carries a state and flips it when pressed.
 * - `stepper` — a label between a `−` and a `+`, each of which is pressed separately.
 * - `label` — text, and nothing to press. It does not capture the pointer.
 */
export type LXRPanelItemKind = "button" | "toggle" | "stepper" | "label";

//------------------------------------------------------------------------------
/**
 * Which part of an item a pointer is on. Only a `stepper` has more than one.
 */
export type LXRPanelItemPart = "body" | "decrement" | "increment";

//------------------------------------------------------------------------------
/**
 * One row of a panel.
 *
 * Items are plain objects rather than instances: a consumer builds an array, hands it over, and
 * changes a field on one of them — `checked`, `value`, `disabled` — through
 * {@link LXRPanel.updateItem}, which is also what tells the panel to redraw itself.
 */
export type LXRPanelItem = {
    /**
     * Identifies the item among the panel's own. Used by {@link LXRPanel.updateItem} and reported
     * back on activation.
     */
    id: string;

    /**
     * What the item is. See {@link LXRPanelItemKind}.
     */
    kind: LXRPanelItemKind;

    /**
     * The text drawn on it.
     */
    label: string;

    /**
     * A second piece of text, drawn to the right of the label on a `label` item and in the middle
     * of a `stepper`. The current scale, a mode name, a confirmation line.
     */
    value?: string;

    /**
     * Whether a `toggle` is on. Meaningless for the other kinds.
     */
    checked?: boolean;

    /**
     * Whether the item is drawn dimmed and refuses to be pressed or hovered.
     */
    disabled?: boolean;

    /**
     * Puts this item on a row of its own (the default) or next to its neighbours. Consecutive items
     * carrying the same number share a row; an item without one always starts a new row.
     */
    row?: number;

    /**
     * How much of its row this item takes, relative to the others on it. Defaults to 1.
     */
    weight?: number;

    /**
     * Called when the item is pressed and released without the pointer leaving it, the way a button
     * anywhere else works. `part` says which end of a stepper was used.
     */
    on_activate?: (args: LXRPanelItemActivateArgs) => void;
};

//------------------------------------------------------------------------------
/**
 * What an item's {@link LXRPanelItem.on_activate} is handed.
 */
export type LXRPanelItemActivateArgs = {
    /**
     * The panel the item belongs to.
     */
    panel: LXRPanel;

    /**
     * The item that was pressed.
     */
    item: LXRPanelItem;

    /**
     * Which part of it. `body` for anything but a stepper.
     */
    part: LXRPanelItemPart;
};

//------------------------------------------------------------------------------
/**
 * Where one item ended up, in canvas pixels. Rebuilt whenever the items or the theme change, and
 * what {@link LXRPanel.hitTest} resolves a ray against.
 */
export type LXRPanelItemLayout = {
    /**
     * The item this describes.
     */
    item: LXRPanelItem;

    /**
     * Left edge, in canvas pixels.
     */
    x: number;

    /**
     * Top edge, in canvas pixels.
     */
    y: number;

    /**
     * Width, in canvas pixels.
     */
    width: number;

    /**
     * Height, in canvas pixels.
     */
    height: number;

    /**
     * The `−` end of a stepper, absent for every other kind.
     */
    decrement?: { x: number; y: number; width: number; height: number };

    /**
     * The `+` end of a stepper, absent for every other kind.
     */
    increment?: { x: number; y: number; width: number; height: number };
};

//------------------------------------------------------------------------------
/**
 * Where a ray met a panel. Reused between calls — read what is needed out of it, do not retain it.
 */
export type LXRPanelHit = {
    /**
     * The panel that was hit.
     */
    panel: LXRPanel;

    /**
     * The item under the ray, or null when it landed on the panel but not on anything actionable —
     * the background, the title, a label, a disabled item. The panel still blocks the ray either
     * way, which is what stops a press from reaching whatever is behind it.
     */
    item: LXRPanelItem | null;

    /**
     * Which part of {@link item} the ray is on.
     */
    part: LXRPanelItemPart;

    /**
     * Across the panel, from 0 at its left edge to 1 at its right.
     */
    u: number;

    /**
     * Down the panel, from 0 at its top edge to 1 at its bottom.
     */
    v: number;

    /**
     * Metres from the ray origin to the panel.
     */
    distance: number;

    /**
     * Where the ray met the panel, in the reference space. Mutated in place.
     */
    point: Vector3;
};

//------------------------------------------------------------------------------
/**
 * A position and an orientation relative to whatever a panel is attached to.
 */
export type LXRPanelPose = {
    /**
     * Metres, in the space of the thing attached to.
     */
    position?: readonly [number, number, number];

    /**
     * Quaternion, `x, y, z, w`, as WebXR reports its orientations.
     */
    orientation?: readonly [number, number, number, number];
};

//------------------------------------------------------------------------------
/**
 * How a panel eases towards the pose it is attached to instead of being nailed to it.
 *
 * A panel rigidly welded to the head is unreadable — it moves with the eyes that are trying to read
 * it — and one that never follows is lost the moment the user turns around. So it stays where it is
 * until the head has turned away by more than {@link dead_angle}, then catches up over
 * {@link follow_seconds} and stops again.
 */
export type LXRLazyFollow = {
    /**
     * Radians the head may turn away from the panel before it starts following. Defaults to
     * {@link LXR_DEFAULT_LAZY_FOLLOW_ANGLE}.
     */
    dead_angle?: number;

    /**
     * Seconds the catch-up takes, as a smoothing time constant rather than a duration. Defaults to
     * {@link LXR_DEFAULT_LAZY_FOLLOW_SECONDS}.
     */
    follow_seconds?: number;
};

//------------------------------------------------------------------------------
/**
 * What a panel follows.
 *
 * - `world` — nothing. The consumer writes {@link LXRQuad.matrix} itself, which is what a panel
 *   pinned to a real surface wants.
 * - `grip` — a controller or a hand, through its grip pose. With {@link reveal_angle} this is the
 *   whole "look at your wrist to summon the menu" gesture, and it is identical for a held
 *   controller and a tracked hand: both report a grip pose, and neither needs a joint API.
 * - `head` — the viewer, optionally with {@link LXRLazyFollow}.
 */
export type LXRPanelAttachment =
    | {
          kind: "world";

          /**
           * An initial pose, copied into {@link LXRQuad.matrix} when the attachment is set. Omit it
           * to keep whatever the panel already had.
           */
          matrix?: ArrayLike<number>;
      }
    | {
          kind: "grip";

          /**
           * The hand to follow.
           */
          handedness: XRHandedness;

          /**
           * Where the panel sits relative to the grip. Grip space has `-z` pointing the way the
           * hand is holding something and `y` up out of the back of the hand, so a wrist panel is
           * a few centimetres along `-z` and turned to face out of the back of the hand.
           */
          offset?: LXRPanelPose;

          /**
           * Radians between the panel's normal and the direction to the viewer, beyond which the
           * panel hides itself. Defaults to {@link LXR_DEFAULT_REVEAL_ANGLE}; pass `Math.PI` for a
           * panel that is always there.
           */
          reveal_angle?: number;
      }
    | {
          kind: "head";

          /**
           * Where the panel sits relative to the viewer. Viewer space looks down `-z`, so a panel
           * in front of the user is at a negative `z`.
           */
          offset?: LXRPanelPose;

          /**
           * Ease towards the pose rather than being welded to it. See {@link LXRLazyFollow}. `true`
           * takes the defaults.
           */
          lazy_follow?: LXRLazyFollow | boolean;
      };

//------------------------------------------------------------------------------
/**
 * The handful of values the default renderer draws a panel with.
 *
 * Small on purpose: it is a fallback that has to be legible on passthrough at arm's length, not a
 * styling system. Anything beyond it goes through {@link LXRPanel.draw_override}.
 */
export type LXRPanelTheme = {
    /**
     * The panel's own background. Opaque enough to read against a bright room.
     */
    background: string;

    /**
     * A button or toggle at rest.
     */
    item_background: string;

    /**
     * One under a pointer.
     */
    item_hover_background: string;

    /**
     * One being pressed.
     */
    item_press_background: string;

    /**
     * The colour a toggle turns when it is on, and the arrows of a stepper.
     */
    accent: string;

    /**
     * Label text.
     */
    text: string;

    /**
     * Secondary text: the title, a value, a disabled item.
     */
    text_muted: string;

    /**
     * The panel's outline, which is what separates it from a dark room.
     */
    border: string;

    /**
     * CSS font family list.
     */
    font_family: string;

    /**
     * Label size, in canvas pixels.
     */
    font_size_px: number;

    /**
     * Title size, in canvas pixels.
     */
    title_font_size_px: number;

    /**
     * Corner radius of the panel and its items, in canvas pixels.
     */
    corner_radius_px: number;

    /**
     * Space between the panel's edge and its contents, in canvas pixels.
     */
    padding_px: number;

    /**
     * Space between two items, in canvas pixels.
     */
    gap_px: number;

    /**
     * Height of one row, in canvas pixels.
     */
    row_height_px: number;
};

//------------------------------------------------------------------------------
/**
 * The tokens {@link LXRPanel} draws with when it is not given others.
 */
export const LXR_DEFAULT_PANEL_THEME: Readonly<LXRPanelTheme> = Object.freeze({
    background: "rgba(18, 20, 26, 0.86)",
    item_background: "rgba(255, 255, 255, 0.10)",
    item_hover_background: "rgba(255, 255, 255, 0.22)",
    item_press_background: "rgba(255, 255, 255, 0.38)",
    accent: "rgb(94, 168, 255)",
    text: "rgb(244, 246, 250)",
    text_muted: "rgba(244, 246, 250, 0.58)",
    border: "rgba(255, 255, 255, 0.16)",
    font_family: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    font_size_px: 26,
    title_font_size_px: 22,
    corner_radius_px: 20,
    padding_px: 24,
    gap_px: 14,
    row_height_px: 72,
} satisfies LXRPanelTheme);

//------------------------------------------------------------------------------
/**
 * Default of {@link LXRPanelAttachment} `reveal_angle`: a panel on the wrist is shown once its face
 * is within 55° of the viewer, which is about where a watch becomes readable.
 */
export const LXR_DEFAULT_REVEAL_ANGLE = (55 * Math.PI) / 180;

//------------------------------------------------------------------------------
/**
 * Hysteresis on the reveal angle, in radians. Without it a wrist held exactly at the threshold
 * flickers the panel on and off at display rate.
 */
const REVEAL_ANGLE_HYSTERESIS = (6 * Math.PI) / 180;

//------------------------------------------------------------------------------
/**
 * Default of {@link LXRLazyFollow} `dead_angle`.
 */
export const LXR_DEFAULT_LAZY_FOLLOW_ANGLE = (18 * Math.PI) / 180;

//------------------------------------------------------------------------------
/**
 * Default of {@link LXRLazyFollow} `follow_seconds`.
 */
export const LXR_DEFAULT_LAZY_FOLLOW_SECONDS = 0.35;

//------------------------------------------------------------------------------
/**
 * Radians below which a lazily following panel is considered to have caught up and stops moving.
 */
const LAZY_FOLLOW_SETTLED_ANGLE = (0.5 * Math.PI) / 180;

//------------------------------------------------------------------------------
/**
 * Longest frame a lazy follow will honour, in seconds, so one stalled frame does not teleport the
 * panel.
 */
const MAX_LAZY_FOLLOW_DELTA_SECONDS = 0.1;

//------------------------------------------------------------------------------
/**
 * A ray that grazes the plane of a panel has no usable intersection: the denominator of the
 * ray/plane solve goes to zero and the point it produces is kilometres away.
 */
const MIN_RAY_PLANE_COSINE = 1e-4;

//------------------------------------------------------------------------------
/**
 * A quad carrying a canvas the library draws a small user interface onto, in the reference space.
 *
 * This is what a headset user is shown, since nothing in the DOM is composited into an immersive
 * session — see {@link LXROverlay}. A panel is sized in **pixels** for its artwork and in **metres**
 * for the world: {@link width_m} is what it measures in the room, {@link height} follows from the
 * pixel aspect so that a pixel stays square, and the two together are what decides how legible it is
 * at the distance it is read from.
 *
 * Its items are laid out in rows and drawn by a small default renderer; a consumer that wants
 * something else sets {@link draw_override} and keeps the layout, the hit testing and the
 * attachment. Pointing at it is {@link LXRPointer}'s job, driven by {@link LXROverlayManager}.
 *
 * @experimental
 */
export class LXRPanel extends LXRQuad {
    /**
     * The artwork, sized in canvas pixels and owned by this panel.
     */
    readonly #texture: LXRTexture;

    /**
     * The items, in the order they are laid out.
     */
    #items: readonly LXRPanelItem[] = [];

    /**
     * Text drawn above the items, or undefined for a panel that is only items.
     */
    #title?: string;

    /**
     * The tokens the default renderer draws with.
     */
    #theme: Readonly<LXRPanelTheme> = LXR_DEFAULT_PANEL_THEME;

    /**
     * Width in metres. See {@link width_m}.
     */
    #width_m: number;

    /**
     * Where each item ended up, rebuilt only when something that moves them changes.
     */
    #layout: LXRPanelItemLayout[] = [];

    /**
     * Whether {@link #layout} has to be rebuilt before it is read.
     */
    #is_layout_dirty: boolean = true;

    /**
     * Whether the canvas has to be redrawn before the next frame that shows it.
     */
    #is_artwork_dirty: boolean = true;

    /**
     * The item a pointer is on and which part of it, for the hover and press highlights.
     */
    #highlight_item_id: string | null = null;
    #highlight_part: LXRPanelItemPart = "body";
    #is_highlight_pressed: boolean = false;

    /**
     * Whether the reveal gate is currently open, kept between frames so the hysteresis has
     * something to compare against.
     */
    #is_revealed: boolean = true;

    /**
     * Where a lazily following panel currently is, and whether it is on its way somewhere.
     */
    readonly #follow_position = new Vector3();
    readonly #follow_orientation = new Quaternion();
    #is_following: boolean = false;
    #has_follow_pose: boolean = false;

    /**
     * Scratch, so that a panel updated every frame allocates nothing.
     */
    readonly #scratch_matrix = new Matrix4();
    readonly #scratch_offset = new Matrix4();
    readonly #scratch_position = new Vector3();
    readonly #scratch_target_position = new Vector3();
    readonly #scratch_orientation = new Quaternion();
    readonly #scratch_scale = new Vector3();
    readonly #scratch_direction = new Vector3();
    readonly #scratch_to_viewer = new Vector3();

    /**
     * The result of the last {@link hitTest}, refilled rather than rebuilt.
     */
    readonly #hit: LXRPanelHit;

    /**
     * What the panel follows. See {@link LXRPanelAttachment}.
     */
    attachment: LXRPanelAttachment = { kind: "world" };

    /**
     * Whether the consumer wants this panel at all.
     *
     * This rather than {@link LXRQuad.visible}, which an attached panel writes on every frame: a
     * wrist panel is visible only while the wrist is turned towards the viewer, and a head-attached
     * one only while there is a viewer pose to attach to.
     */
    is_shown: boolean = true;

    /**
     * Whether a pointer can land on this panel. False makes it a picture: it is drawn, and rays go
     * through it to whatever is behind.
     */
    interactive: boolean = true;

    /**
     * Draw the panel's artwork instead of the default renderer.
     *
     * The canvas is cleared before this runs, and {@link LXRTexture.markDirty} is called after it.
     * The layout and the hit testing are unaffected — an override that draws items somewhere else
     * than {@link layout} says they are is a panel that cannot be pressed where it looks like it can.
     */
    draw_override?: (args: { panel: LXRPanel; context: CanvasRenderingContext2D }) => void;

    /**
     * @param width_px Width of the artwork canvas, in pixels.
     * @param height_px Height of the artwork canvas, in pixels.
     * @param width_m Width in the real world, in metres. See {@link width_m}.
     * @param items What the panel shows. See {@link items}.
     * @param title Text drawn above the items.
     * @param theme The tokens the default renderer draws with.
     * @param attachment What the panel follows.
     * @param z_order Draw order among the overlay's quads, lowest first.
     */
    constructor({
        width_px,
        height_px,
        width_m = 0.25,
        items = [],
        title,
        theme,
        attachment,
        z_order,
    }: {
        width_px: number;
        height_px: number;
        width_m?: number;
        items?: readonly LXRPanelItem[];
        title?: string;
        theme?: Partial<LXRPanelTheme>;
        attachment?: LXRPanelAttachment;
        z_order?: number;
    }) {
        super({ z_order });

        this.#texture = new LXRTexture({ width: width_px, height: height_px });
        this.texture = this.#texture;

        this.#items = items;
        this.#title = title;
        if (theme) {
            this.#theme = Object.freeze({ ...LXR_DEFAULT_PANEL_THEME, ...theme });
        }

        this.#width_m = width_m;
        this.#applyMetricSize();

        if (attachment) {
            this.attachment = attachment;
            this.#applyWorldMatrix(attachment);
        }

        this.#hit = {
            panel: this,
            item: null,
            part: "body",
            u: 0,
            v: 0,
            distance: 0,
            point: new Vector3(),
        };
    }

    /**
     * Width of the artwork canvas, in pixels.
     */
    get width_px(): number {
        return this.#texture.width;
    }

    /**
     * Height of the artwork canvas, in pixels.
     */
    get height_px(): number {
        return this.#texture.height;
    }

    /**
     * Width in the real world, in metres.
     *
     * {@link LXRQuad.height} follows from it and the pixel aspect, so a square in the artwork is a
     * square in the room. Writing {@link LXRQuad.width} directly is what breaks that.
     */
    get width_m(): number {
        return this.#width_m;
    }

    /**
     * Set the width in the real world, in metres. See {@link width_m}.
     */
    set width_m(value: number) {
        this.#width_m = value;
        this.#applyMetricSize();
    }

    /**
     * The artwork this panel draws into.
     */
    get panel_texture(): LXRTexture {
        return this.#texture;
    }

    /**
     * What the panel shows, in the order it is laid out.
     */
    get items(): readonly LXRPanelItem[] {
        return this.#items;
    }

    /**
     * Replace what the panel shows. The layout and the artwork are both rebuilt on the next frame.
     */
    set items(value: readonly LXRPanelItem[]) {
        this.#items = value;
        this.#highlight_item_id = null;
        this.#is_layout_dirty = true;
        this.#is_artwork_dirty = true;
    }

    /**
     * Text drawn above the items.
     */
    get title(): string | undefined {
        return this.#title;
    }

    /**
     * Set the text drawn above the items. Adding or removing one moves every row.
     */
    set title(value: string | undefined) {
        const had_title = this.#title !== undefined;
        this.#title = value;
        this.#is_artwork_dirty = true;
        if (had_title !== (value !== undefined)) {
            this.#is_layout_dirty = true;
        }
    }

    /**
     * The tokens the default renderer draws with.
     */
    get theme(): Readonly<LXRPanelTheme> {
        return this.#theme;
    }

    /**
     * Set the tokens the default renderer draws with. Anything left out keeps its default.
     */
    set theme(value: Partial<LXRPanelTheme>) {
        this.#theme = Object.freeze({ ...LXR_DEFAULT_PANEL_THEME, ...value });
        this.#is_layout_dirty = true;
        this.#is_artwork_dirty = true;
    }

    /**
     * Where every item ended up, in canvas pixels. Rebuilt on read when something moved them.
     */
    get layout(): readonly LXRPanelItemLayout[] {
        if (this.#is_layout_dirty) {
            this.#is_layout_dirty = false;
            this.#layout = layOutPanelItems({
                items: this.#items,
                title: this.#title,
                theme: this.#theme,
                width_px: this.width_px,
            });
        }
        return this.#layout;
    }

    /**
     * One of the panel's items.
     *
     * @param id The item id.
     */
    getItem(id: string): LXRPanelItem | undefined {
        return this.#items.find(item => item.id === id);
    }

    /**
     * Change one item and redraw the panel.
     *
     * The item objects are the consumer's own, so writing to one directly works too — this is what
     * makes the change show up, which writing to it does not.
     *
     * @param id The item to change.
     * @param patch The fields to write onto it.
     * @returns Whether there was such an item.
     */
    updateItem(id: string, patch: Partial<Omit<LXRPanelItem, "id">>): boolean {
        const item = this.getItem(id);
        if (!item) {
            return false;
        }

        Object.assign(item, patch);
        this.#is_artwork_dirty = true;
        // Only these move things; a label or a checked state does not.
        if (patch.row !== undefined || patch.weight !== undefined || patch.kind !== undefined) {
            this.#is_layout_dirty = true;
        }
        return true;
    }

    /**
     * Redraw the panel on the next frame, for a consumer that changed an item object itself.
     */
    invalidate(): void {
        this.#is_artwork_dirty = true;
    }

    /**
     * Where a ray meets this panel.
     *
     * @param origin Where the ray starts, in the reference space.
     * @param direction Which way it points. Need not be normalised.
     * @returns The hit, reused between calls, or null when the ray misses or points away.
     */
    hitTest({ origin, direction }: { origin: Vector3; direction: Vector3 }): Readonly<LXRPanelHit> | null {
        const m = this.matrix;

        // The panel's own axes, straight out of the columns of its pose: `x` across, `y` up, `z` the
        // side it is seen from. Their lengths divide back out below, so a consumer that put a scaled
        // matrix in still gets the right fractions.
        const axis_x = this.#scratch_direction.set(m[0], m[1], m[2]);
        const length_x_squared = axis_x.lengthSq();

        const normal = this.#scratch_to_viewer.set(m[8], m[9], m[10]);
        const denominator = direction.dot(normal);
        if (Math.abs(denominator) < MIN_RAY_PLANE_COSINE * direction.length() * normal.length()) {
            return null;
        }

        const panel_position = this.#scratch_position.set(m[12], m[13], m[14]);
        const to_panel = this.#scratch_target_position.copy(panel_position).sub(origin);
        const t = to_panel.dot(normal) / denominator;
        if (!(t > 0)) {
            return null;
        }

        const point = this.#hit.point.copy(direction).multiplyScalar(t).add(origin);
        const to_point = this.#scratch_target_position.copy(point).sub(panel_position);

        const local_x = to_point.dot(axis_x) / (length_x_squared * this.width);
        if (local_x < -0.5 || local_x > 0.5) {
            return null;
        }

        const axis_y_vector = this.#scratch_direction.set(m[4], m[5], m[6]);
        const local_y = to_point.dot(axis_y_vector) / (axis_y_vector.lengthSq() * this.height);
        if (local_y < -0.5 || local_y > 0.5) {
            return null;
        }

        const hit = this.#hit;
        hit.u = local_x + 0.5;
        hit.v = 0.5 - local_y;
        hit.distance = t * direction.length();

        const layout = this.#findLayoutAt({ x: hit.u * this.width_px, y: hit.v * this.height_px });
        hit.item = layout ? layout.layout.item : null;
        hit.part = layout ? layout.part : "body";
        return hit;
    }

    /**
     * @internal
     *
     * Follow whatever this panel is attached to, and redraw its artwork if anything changed.
     *
     * @param dt Seconds since the previous XR frame.
     * @param viewer_pose The viewer pose for this frame, or null when tracking is lost.
     * @param input The session's input sources, for a grip attachment.
     */
    _update({
        dt,
        viewer_pose,
        input,
    }: {
        dt: number;
        viewer_pose: XRViewerPose | null;
        input: LXRInputManager | undefined;
    }): void {
        this.visible = this.is_shown && this.#updatePose({ dt, viewer_pose, input });

        if (this.#is_artwork_dirty && this.visible) {
            this.#is_artwork_dirty = false;
            this.#drawArtwork();
        }
    }

    /**
     * @internal
     *
     * Mark which item a pointer is on, for the hover and press highlights.
     *
     * @param item_id The item under the pointer, or null for none.
     * @param part Which part of it.
     * @param is_pressed Whether it is being pressed.
     */
    _setHighlight({
        item_id,
        part = "body",
        is_pressed = false,
    }: {
        item_id: string | null;
        part?: LXRPanelItemPart;
        is_pressed?: boolean;
    }): void {
        if (
            this.#highlight_item_id === item_id &&
            this.#highlight_part === part &&
            this.#is_highlight_pressed === is_pressed
        ) {
            return;
        }

        this.#highlight_item_id = item_id;
        this.#highlight_part = part;
        this.#is_highlight_pressed = is_pressed;
        this.#is_artwork_dirty = true;
    }

    /**
     * Hand the artwork's GPU texture back. The panel can be drawn again afterwards; it simply
     * uploads itself once more.
     */
    release(): void {
        this.#texture.release();
        this.#is_artwork_dirty = true;
    }

    /**
     * Keep {@link LXRQuad.width} and {@link LXRQuad.height} in the pixel aspect of the artwork.
     */
    #applyMetricSize(): void {
        this.width = this.#width_m;
        this.height = (this.#width_m * this.height_px) / this.width_px;
    }

    /**
     * Copy the initial pose of a `world` attachment, if it carries one.
     *
     * @param attachment The attachment being set.
     */
    #applyWorldMatrix(attachment: LXRPanelAttachment): void {
        if (attachment.kind === "world" && attachment.matrix) {
            this.matrix.set(attachment.matrix);
        }
    }

    /**
     * Write this frame's pose from the attachment.
     *
     * @param dt Seconds since the previous XR frame.
     * @param viewer_pose The viewer pose for this frame.
     * @param input The session's input sources.
     * @returns Whether there is a pose to show the panel at.
     */
    #updatePose({
        dt,
        viewer_pose,
        input,
    }: {
        dt: number;
        viewer_pose: XRViewerPose | null;
        input: LXRInputManager | undefined;
    }): boolean {
        const { attachment } = this;

        if (attachment.kind === "world") {
            this.#is_following = false;
            this.#has_follow_pose = false;
            return true;
        }

        if (attachment.kind === "grip") {
            const grip_pose = input?.getByHandedness(attachment.handedness)?.grip_pose;
            if (!grip_pose) {
                // The hand is not tracked, and a wrist panel left at the last place the wrist was
                // is a menu floating in the room.
                this.#is_revealed = false;
                return false;
            }

            this.#composeAttachedMatrix({ base: grip_pose.transform.matrix, offset: attachment.offset });
            this.matrix.set(this.#scratch_matrix.elements);
            return this.#updateReveal({
                viewer_pose,
                reveal_angle: attachment.reveal_angle ?? LXR_DEFAULT_REVEAL_ANGLE,
            });
        }

        if (!viewer_pose) {
            return false;
        }

        this.#composeAttachedMatrix({ base: viewer_pose.transform.matrix, offset: attachment.offset });

        const lazy_follow = attachment.lazy_follow;
        if (!lazy_follow) {
            this.matrix.set(this.#scratch_matrix.elements);
            this.#has_follow_pose = false;
            return true;
        }

        this.#applyLazyFollow({
            dt,
            viewer_pose,
            lazy_follow: lazy_follow === true ? {} : lazy_follow,
        });
        return true;
    }

    /**
     * Compose `base × offset` into {@link #scratch_matrix}.
     *
     * @param base The pose attached to, column-major.
     * @param offset Where the panel sits in its space.
     */
    #composeAttachedMatrix({ base, offset }: { base: Float32Array; offset?: LXRPanelPose }): void {
        this.#scratch_matrix.fromArray(base as unknown as number[]);

        if (!offset || (!offset.position && !offset.orientation)) {
            return;
        }

        const position = offset.position ?? [0, 0, 0];
        const orientation = offset.orientation ?? [0, 0, 0, 1];
        this.#scratch_offset.compose(
            this.#scratch_position.set(position[0], position[1], position[2]),
            this.#scratch_orientation.set(orientation[0], orientation[1], orientation[2], orientation[3]),
            this.#scratch_scale.set(1, 1, 1),
        );
        this.#scratch_matrix.multiply(this.#scratch_offset);
    }

    /**
     * Open or close the reveal gate for this frame, with a few degrees of hysteresis so a wrist held
     * at the threshold does not flicker.
     *
     * @param viewer_pose The viewer pose for this frame.
     * @param reveal_angle Radians the panel's normal may be from the direction to the viewer.
     * @returns Whether the panel is revealed.
     */
    #updateReveal({ viewer_pose, reveal_angle }: { viewer_pose: XRViewerPose | null; reveal_angle: number }): boolean {
        if (!viewer_pose || reveal_angle >= Math.PI) {
            this.#is_revealed = true;
            return true;
        }

        const m = this.matrix;
        const normal = this.#scratch_direction.set(m[8], m[9], m[10]).normalize();
        const { position } = viewer_pose.transform;
        const to_viewer = this.#scratch_to_viewer
            .set(position.x - m[12], position.y - m[13], position.z - m[14])
            .normalize();

        const angle = Math.acos(Math.min(1, Math.max(-1, normal.dot(to_viewer))));
        // Asymmetric on purpose: it takes a little more turn to reveal the panel than to keep it.
        const threshold = this.#is_revealed ? reveal_angle + REVEAL_ANGLE_HYSTERESIS : reveal_angle;
        this.#is_revealed = angle <= threshold;
        return this.#is_revealed;
    }

    /**
     * Ease the panel towards the head-attached pose in {@link #scratch_matrix}, moving only once the
     * head has turned away by more than the dead angle.
     *
     * @param dt Seconds since the previous XR frame.
     * @param viewer_pose The viewer pose for this frame.
     * @param lazy_follow How far and how fast.
     */
    #applyLazyFollow({
        dt,
        viewer_pose,
        lazy_follow,
    }: {
        dt: number;
        viewer_pose: XRViewerPose | null;
        lazy_follow: LXRLazyFollow;
    }): void {
        this.#scratch_matrix.decompose(this.#scratch_target_position, this.#scratch_orientation, this.#scratch_scale);

        if (!this.#has_follow_pose) {
            this.#has_follow_pose = true;
            this.#is_following = false;
            this.#follow_position.copy(this.#scratch_target_position);
            this.#follow_orientation.copy(this.#scratch_orientation);
            this.#writeFollowMatrix();
            return;
        }

        const dead_angle = lazy_follow.dead_angle ?? LXR_DEFAULT_LAZY_FOLLOW_ANGLE;
        const angle = this.#angleFromViewer({ viewer_pose });
        if (angle > dead_angle) {
            this.#is_following = true;
        } else if (angle <= LAZY_FOLLOW_SETTLED_ANGLE) {
            this.#is_following = false;
        }

        if (this.#is_following && dt > 0) {
            const follow_seconds = lazy_follow.follow_seconds ?? LXR_DEFAULT_LAZY_FOLLOW_SECONDS;
            const alpha = 1 - Math.exp(-Math.min(dt, MAX_LAZY_FOLLOW_DELTA_SECONDS) / Math.max(follow_seconds, 1e-3));
            this.#follow_position.lerp(this.#scratch_target_position, alpha);
            this.#follow_orientation.slerp(this.#scratch_orientation, alpha);
        }

        this.#writeFollowMatrix();
    }

    /**
     * The angle, at the viewer, between where the panel is and where its attachment wants it.
     *
     * Measured from the viewer rather than in the room, because that is what the user perceives: a
     * panel two metres away may be half a metre off target and still be exactly where they left it
     * in their field of view.
     *
     * @param viewer_pose The viewer pose for this frame.
     */
    #angleFromViewer({ viewer_pose }: { viewer_pose: XRViewerPose | null }): number {
        if (!viewer_pose) {
            return 0;
        }

        const { position } = viewer_pose.transform;
        const to_current = this.#scratch_direction
            .copy(this.#follow_position)
            .sub(this.#scratch_position.set(position.x, position.y, position.z));
        const to_target = this.#scratch_to_viewer
            .copy(this.#scratch_target_position)
            .sub(this.#scratch_position.set(position.x, position.y, position.z));

        const lengths = to_current.length() * to_target.length();
        if (lengths <= 0) {
            return 0;
        }

        return Math.acos(Math.min(1, Math.max(-1, to_current.dot(to_target) / lengths)));
    }

    /**
     * Write the eased pose of a lazily following panel into {@link LXRQuad.matrix}.
     */
    #writeFollowMatrix(): void {
        this.#scratch_matrix.compose(this.#follow_position, this.#follow_orientation, this.#scratch_scale.set(1, 1, 1));
        this.matrix.set(this.#scratch_matrix.elements);
    }

    /**
     * The item at a point of the artwork, if it is one a pointer can act on.
     *
     * @param x Canvas pixels from the left edge.
     * @param y Canvas pixels from the top edge.
     */
    #findLayoutAt({ x, y }: { x: number; y: number }): { layout: LXRPanelItemLayout; part: LXRPanelItemPart } | null {
        for (const layout of this.layout) {
            const { item } = layout;
            if (item.kind === "label" || item.disabled) {
                continue;
            }
            if (x < layout.x || x > layout.x + layout.width || y < layout.y || y > layout.y + layout.height) {
                continue;
            }

            if (layout.decrement && x <= layout.decrement.x + layout.decrement.width) {
                return { layout, part: "decrement" };
            }
            if (layout.increment && x >= layout.increment.x) {
                return { layout, part: "increment" };
            }
            return { layout, part: "body" };
        }
        return null;
    }

    /**
     * Redraw the artwork, either through {@link draw_override} or with the default renderer.
     */
    #drawArtwork(): void {
        const context = this.#texture.context_2d;
        if (!context) {
            return;
        }

        const width = this.width_px;
        const height = this.height_px;
        context.clearRect(0, 0, width, height);

        if (this.draw_override) {
            this.draw_override({ panel: this, context });
            this.#texture.markDirty();
            return;
        }

        const theme = this.#theme;

        context.fillStyle = theme.background;
        roundedRectPath(context, 0, 0, width, height, theme.corner_radius_px);
        context.fill();

        context.strokeStyle = theme.border;
        context.lineWidth = 2;
        roundedRectPath(context, 1, 1, width - 2, height - 2, theme.corner_radius_px);
        context.stroke();

        if (this.#title !== undefined) {
            context.fillStyle = theme.text_muted;
            context.font = `${theme.title_font_size_px}px ${theme.font_family}`;
            context.textAlign = "left";
            context.textBaseline = "middle";
            context.fillText(
                this.#title,
                theme.padding_px,
                theme.padding_px + theme.title_font_size_px * 0.7,
                width - 2 * theme.padding_px,
            );
        }

        for (const layout of this.layout) {
            this.#drawItem({ context, layout });
        }

        this.#texture.markDirty();
    }

    /**
     * Draw one item.
     *
     * @param context The canvas to draw into.
     * @param layout Where the item goes.
     */
    #drawItem({ context, layout }: { context: CanvasRenderingContext2D; layout: LXRPanelItemLayout }): void {
        const theme = this.#theme;
        const { item, x, y, width, height } = layout;
        const is_highlighted = this.#highlight_item_id === item.id && !item.disabled;

        context.font = `${theme.font_size_px}px ${theme.font_family}`;
        context.textBaseline = "middle";

        if (item.kind === "label") {
            context.textAlign = "left";
            context.fillStyle = theme.text_muted;
            context.fillText(item.label, x, y + height / 2, width);
            if (item.value !== undefined) {
                context.textAlign = "right";
                context.fillStyle = theme.text;
                context.fillText(item.value, x + width, y + height / 2, width);
            }
            return;
        }

        if (item.kind === "stepper") {
            this.#drawStepper({ context, layout, is_highlighted });
            return;
        }

        context.fillStyle = this.#itemBackground({ item, is_highlighted });
        roundedRectPath(context, x, y, width, height, theme.corner_radius_px * 0.6);
        context.fill();

        context.fillStyle = item.disabled ? theme.text_muted : theme.text;
        context.textAlign = item.kind === "toggle" ? "left" : "center";
        const text_x = item.kind === "toggle" ? x + theme.padding_px * 0.6 : x + width / 2;
        context.fillText(item.label, text_x, y + height / 2, width - theme.padding_px);

        if (item.kind === "toggle") {
            this.#drawToggleSwitch({ context, layout });
        }
    }

    /**
     * The background one item, or one end of a stepper, is drawn with.
     *
     * @param item The item being drawn.
     * @param is_highlighted Whether a pointer is on it.
     * @param part Which part of it is being drawn. A stepper highlights one end at a time.
     */
    #itemBackground({
        item,
        is_highlighted,
        part,
    }: {
        item: LXRPanelItem;
        is_highlighted: boolean;
        part?: LXRPanelItemPart;
    }): string {
        const theme = this.#theme;
        if (item.disabled || !is_highlighted || (part !== undefined && this.#highlight_part !== part)) {
            return theme.item_background;
        }
        return this.#is_highlight_pressed ? theme.item_press_background : theme.item_hover_background;
    }

    /**
     * Draw the pill and knob of a toggle, at the right end of its row.
     *
     * @param context The canvas to draw into.
     * @param layout Where the toggle goes.
     */
    #drawToggleSwitch({ context, layout }: { context: CanvasRenderingContext2D; layout: LXRPanelItemLayout }): void {
        const theme = this.#theme;
        const { item, x, y, width, height } = layout;

        const switch_height = height * 0.5;
        const switch_width = switch_height * 1.8;
        const switch_x = x + width - theme.padding_px * 0.6 - switch_width;
        const switch_y = y + (height - switch_height) / 2;
        const radius = switch_height / 2;

        context.fillStyle = item.checked ? theme.accent : theme.item_background;
        roundedRectPath(context, switch_x, switch_y, switch_width, switch_height, radius);
        context.fill();

        context.fillStyle = theme.text;
        context.beginPath();
        context.arc(
            item.checked ? switch_x + switch_width - radius : switch_x + radius,
            switch_y + radius,
            radius * 0.72,
            0,
            Math.PI * 2,
        );
        context.fill();
    }

    /**
     * Draw a stepper: its two ends, each highlighted on its own, and its readout between them.
     *
     * @param context The canvas to draw into.
     * @param layout Where the stepper goes.
     * @param is_highlighted Whether a pointer is on this item at all.
     */
    #drawStepper({
        context,
        layout,
        is_highlighted,
    }: {
        context: CanvasRenderingContext2D;
        layout: LXRPanelItemLayout;
        is_highlighted: boolean;
    }): void {
        const theme = this.#theme;
        const { item, x, y, width, height, decrement, increment } = layout;
        if (!decrement || !increment) {
            return;
        }

        const text_colour = item.disabled ? theme.text_muted : theme.text;
        const end_radius = theme.corner_radius_px * 0.6;

        context.fillStyle = this.#itemBackground({ item, is_highlighted, part: "decrement" });
        roundedRectPath(context, decrement.x, decrement.y, decrement.width, decrement.height, end_radius);
        context.fill();

        context.fillStyle = this.#itemBackground({ item, is_highlighted, part: "increment" });
        roundedRectPath(context, increment.x, increment.y, increment.width, increment.height, end_radius);
        context.fill();

        context.fillStyle = item.disabled ? theme.text_muted : theme.accent;
        context.textAlign = "center";
        context.fillText("−", decrement.x + decrement.width / 2, decrement.y + decrement.height / 2);
        context.fillText("+", increment.x + increment.width / 2, increment.y + increment.height / 2);

        context.fillStyle = text_colour;
        context.textAlign = "center";
        const middle_x = x + width / 2;
        if (item.value !== undefined) {
            context.fillText(item.label, middle_x, y + height * 0.32, width - 2 * decrement.width);
            context.fillStyle = theme.text_muted;
            context.fillText(item.value, middle_x, y + height * 0.72, width - 2 * decrement.width);
        } else {
            context.fillText(item.label, middle_x, y + height / 2, width - 2 * decrement.width);
        }
    }
}

//------------------------------------------------------------------------------
/**
 * Group items into rows: consecutive items carrying the same {@link LXRPanelItem.row} share one, and
 * an item without a row number gets its own.
 *
 * @param items The items to group.
 * @returns The rows, in order.
 */
export function buildLXRPanelRows(items: readonly LXRPanelItem[]): LXRPanelItem[][] {
    const rows: LXRPanelItem[][] = [];
    let current: LXRPanelItem[] | null = null;
    let current_row: number | undefined;

    for (const item of items) {
        if (current && item.row !== undefined && item.row === current_row) {
            current.push(item);
        } else {
            current = [item];
            current_row = item.row;
            rows.push(current);
        }
    }
    return rows;
}

//------------------------------------------------------------------------------
/**
 * The canvas height a panel needs for its items, in pixels.
 *
 * A panel's artwork canvas cannot be resized after it is built — the texture is uploaded against it
 * — so this is what a consumer sizes one with instead of guessing.
 *
 * @param items What the panel will show.
 * @param title Whether it has a title, and what it says.
 * @param theme The tokens it will be drawn with. Anything left out takes its default.
 * @returns The height, in canvas pixels.
 */
export function computeLXRPanelHeight({
    items,
    title,
    theme: partial_theme,
}: {
    items: readonly LXRPanelItem[];
    title?: string;
    theme?: Partial<LXRPanelTheme>;
}): number {
    const theme = { ...LXR_DEFAULT_PANEL_THEME, ...partial_theme };
    const row_count = buildLXRPanelRows(items).length;
    const rows_height = row_count > 0 ? row_count * theme.row_height_px + (row_count - 1) * theme.gap_px : 0;

    return Math.ceil(2 * theme.padding_px + titleBlockHeight({ title, theme }) + rows_height);
}

//------------------------------------------------------------------------------
/**
 * Height the title takes above the first row, gap included, or 0 for a panel without one.
 *
 * @param title The title, if any.
 * @param theme The tokens the panel is drawn with.
 */
function titleBlockHeight({ title, theme }: { title?: string; theme: LXRPanelTheme }): number {
    return title === undefined ? 0 : theme.title_font_size_px * 1.4 + theme.gap_px;
}

//------------------------------------------------------------------------------
/**
 * Place every item in canvas pixels: rows top to bottom, and within a row, side by side in
 * proportion to their weights.
 *
 * @param items The items to place.
 * @param title The panel's title, which pushes the first row down.
 * @param theme The tokens the panel is drawn with.
 * @param width_px Width of the artwork canvas.
 * @returns One entry per item, in the order they were given.
 */
function layOutPanelItems({
    items,
    title,
    theme,
    width_px,
}: {
    items: readonly LXRPanelItem[];
    title?: string;
    theme: LXRPanelTheme;
    width_px: number;
}): LXRPanelItemLayout[] {
    const layout: LXRPanelItemLayout[] = [];
    const content_x = theme.padding_px;
    const content_width = Math.max(0, width_px - 2 * theme.padding_px);
    let y = theme.padding_px + titleBlockHeight({ title, theme });

    for (const row of buildLXRPanelRows(items)) {
        const total_weight = row.reduce((total, item) => total + (item.weight ?? 1), 0) || 1;
        const available = Math.max(0, content_width - theme.gap_px * (row.length - 1));

        let x = content_x;
        for (const item of row) {
            const width = (available * (item.weight ?? 1)) / total_weight;
            const entry: LXRPanelItemLayout = { item, x, y, width, height: theme.row_height_px };

            if (item.kind === "stepper") {
                // Square ends, unless the item is too narrow for two of them and a readout.
                const end = Math.min(theme.row_height_px, width / 3);
                entry.decrement = { x, y, width: end, height: theme.row_height_px };
                entry.increment = { x: x + width - end, y, width: end, height: theme.row_height_px };
            }

            layout.push(entry);
            x += width + theme.gap_px;
        }

        y += theme.row_height_px + theme.gap_px;
    }

    return layout;
}

//------------------------------------------------------------------------------
/**
 * Trace a rounded rectangle, with `arcTo` rather than `roundRect`, which is recent enough that a
 * headset browser two versions behind does not have it.
 *
 * @param context The canvas to trace into.
 * @param x Left edge.
 * @param y Top edge.
 * @param width Width of the rectangle.
 * @param height Height of the rectangle.
 * @param radius Corner radius, clamped to half the shortest side.
 */
function roundedRectPath(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));

    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
}
