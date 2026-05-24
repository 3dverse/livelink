//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
// nipplejs v5 does not re-export its internal types as named exports.
// Derive manager and options types from the exported `create` function instead.
import type { create as nippleCreate } from "nipplejs";

type NippleManager = ReturnType<typeof nippleCreate>;
type NippleOptions = Parameters<typeof nippleCreate>[0];

//------------------------------------------------------------------------------
/**
 * The event data emitted on joystick move events.
 *
 * Mirrors the `JoystickEventData` shape from nipplejs v5.
 */
export type JoystickEvent = {
    angle: { degree: number; radian: number };
    direction?: { x?: "left" | "right"; y?: "up" | "down"; angle?: string };
    vector: { x: number; y: number };
    distance: number;
    force: number;
    position: { x: number; y: number };
    pressure: number;
};

/**
 *
 */
export const VirtualJoystick = ({
    options: propsOptions,
    onStart: propsOnStart,
    onMove: propsOnMove,
    onEnd: propsOnEnd,
}: {
    container?: HTMLElement;
    options?: VirtualJoystickOptions;
    onStart?: JoystickCallback;
    onMove?: JoystickCallback;
    onEnd?: JoystickCallback;
}) => {
    const [manager, setManager] = useState<NippleManager | null>(null);

    useEffect(() => {
        let isMounted = true;
        let currentManager: NippleManager | null = null;

        createNippleJSManager(propsOptions).then(manager => {
            if (isMounted) {
                setManager(manager);
                currentManager = manager;
            } else {
                manager.destroy();
            }
        });

        return () => {
            isMounted = false;
            if (currentManager) {
                currentManager.destroy();
                setManager(null);
            }
        };
    }, [propsOptions]);

    useJoystickEvent(manager, "start", propsOnStart);
    useJoystickEvent(manager, "move", propsOnMove);
    useJoystickEvent(manager, "end", propsOnEnd);

    return null;
};

/**
 *
 */
function useJoystickEvent(
    manager: NippleManager | null,
    eventName: string,
    callback: ((data: JoystickEvent) => void) | undefined,
) {
    useEffect(() => {
        if (!callback || !manager) {
            return;
        }

        // nipplejs v5 callbacks receive a single InternalEvent<T> where the
        // payload is in `evt.data`. The `on` overloads are per-event-name, so
        // we cast through unknown to call with a dynamic event name.
        type EventHandler = (evt: { data: JoystickEvent }) => void;
        const handler: EventHandler = evt => callback(evt.data);
        const m = manager as unknown as {
            on(event: string, handler: EventHandler): void;
            off(event: string, handler: EventHandler): void;
        };

        m.on(eventName, handler);
        return () => m.off(eventName, handler);
    }, [manager, eventName, callback]);
}

/**
 *
 */
async function createNippleJSManager(options?: VirtualJoystickOptions): Promise<NippleManager> {
    let formattedOptions: NippleOptions = {};
    if (options) {
        formattedOptions = {
            ...options,
        };
        if (options.container) {
            formattedOptions.zone = options.container;
        }
        if (options.isHidden !== undefined) {
            formattedOptions.dataOnly = options.isHidden;
        }
    }
    const mod = await import("nipplejs");
    const nipplejs = mod.default || mod;
    const manager = nipplejs.create(formattedOptions);
    return manager;
}

/**
 *
 */
export type JoystickCallback = (event: JoystickEvent) => void;

/**
 *
 */
export type VirtualJoystickOptions = {
    /**
     * Defaults to `document.body`
     *
     * The container where the joystick will be created.
     *
     * If you want to use a specific element, you can pass it here.
     * Otherwise it will default to the body of the document.
     */
    container?: HTMLElement;

    /**
     * Defaults to `'white'`
     * The background color of your joystick's elements.
     *
     * Can be any valid CSS color.
     */
    color?: string;

    /**
     * Defaults to `100`
     * The size in pixel of the outer circle.
     *
     * The inner circle is 50% of this size.
     */
    size?: number;

    /**
     * Defaults to `false`
     *
     * Enable the multitouch capabilities.
     *
     * If, for reasons, you need to have multiple nipples into the same zone.
     *
     * Otherwise it will only get one, and all new touches won't do a thing.
     *
     * Please note that multitouch is off when in static or semi modes.
     */
    multitouch?: boolean;

    /**
     * Defaults to `1`
     *
     * If you need to, you can also control the maximum number of instance that could be created.
     *
     * Obviously in a multitouch configuration.
     */
    maxNumberOfNipples?: number;

    /**
     * Defaults to `false`
     *
     * The library won't draw anything in the DOM and will only trigger events with data.
     */
    isHidden?: boolean;

    /**
     * Defaults to `{top: 0, left: 0}`
     *
     * An object that will determine the position of a static mode.
     *
     * You can pass any of the four top, right, bottom and left.
     *
     * They will be applied as any css property.
     */
    position?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };

    /**
     * Behavioral mode for the joystick
     *
     * ### 'dynamic':
     * a new joystick is created at each new touch.
     * the joystick gets destroyed when released.
     * can be multitouch.
     *
     * ### 'semi':
     * new joystick is created at each new touch farther than options.catchDistance of any previously created joystick.
     * the joystick is faded-out when released but not destroyed.
     * when touch is made inside the options.catchDistance a new direction is triggered immediately.
     * when touch is made outside the options.catchDistance the previous joystick is destroyed and a new one is created.
     * cannot be multitouch.
     *
     * ### 'static':
     * a joystick is positioned immediately at options.position.
     * one joystick per zone.
     * each new touch triggers a new direction.
     * cannot be multitouch.
     */
    mode?: "dynamic" | "semi" | "static";

    /**
     * Defaults to `200`
     *
     * This is only useful in the semi mode, and determine at which distance we recycle the previous joystick.
     */
    catchDistance?: number;

    /**
     * Defaults to `false`
     *
     * Locks joystick's movement to the x (horizontal) axis
     */
    lockX?: boolean;

    /**
     * Defaults to `false`
     *
     * Locks joystick's movement to the y (vertical) axis
     */
    lockY?: boolean;

    /**
     * Defaults to `false`
     *
     * Enable if the page has dynamically visible elements such as for Vue, React, Angular or simply some CSS hiding or
     * showing some DOM.
     */
    dynamicPage?: boolean;
};
