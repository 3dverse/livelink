import { vec3 } from "gl-matrix";
import React, { type ReactElement } from "react";

/**
 *
 */
export class React3DElement {
    /**
     *
     */
    world_position = vec3.create();

    /**
     *
     */
    screen_position = vec3.create();

    /**
     *
     */
    scale = 1.0;

    /**
     *
     */
    element: ReactElement;

    /**
     *
     */
    scale_factor?: number;

    /**
     *
     */
    constructor({
        element,
        scale_factor,
        world_position = vec3.create(),
    }: {
        element: ReactElement;
        scale_factor?: number;
        world_position?: vec3;
    }) {
        this.element = element;
        this.world_position = world_position;
        this.scale_factor = scale_factor;
    }

    /**
     * @internal
     */
    _render({ z_index }: { z_index: number }): ReactElement {
        const transformStyle = `
            translate(-50%,-50%)
            translate(${this.screen_position[0]}px, ${this.screen_position[1]}px)`;

        return (
            <div
                key={z_index}
                style={{
                    position: "absolute",
                    transform: transformStyle,
                    zIndex: z_index,
                    pointerEvents: "auto",
                }}
            >
                {this.scale_factor ? (
                    <div style={{ transform: `scale(${this.scale})` }}>{this.element}</div>
                ) : (
                    this.element
                )}
            </div>
        );
    }
}
