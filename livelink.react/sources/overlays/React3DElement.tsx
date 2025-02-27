import React, { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";
import { vec3 } from "gl-matrix";
import type { ReactOverlay, Projection } from "./ReactOverlay";

/**
 *
 */
export type React3DElementProps = PropsWithChildren<{
    worldPosition: vec3;
    scaleFactor?: number;
}>;

/**
 * @internal
 */
export function createReact3DElementFactory(overlay: ReactOverlay): (props: React3DElementProps) => React.ReactElement {
    return (props: React3DElementProps): React.ReactElement => {
        return <React3DElement overlay={overlay} {...props} />;
    };
}

/**
 * @internal
 */
export class React3DElement extends React.Component<
    { overlay: ReactOverlay } & React3DElementProps,
    { screen_position: vec3; z_index: number; scale: number; is_visible: boolean }
> {
    /**
     *
     */
    state = {
        screen_position: vec3.create(),
        z_index: 0,
        scale: 1,
        is_visible: false,
    };

    /**
     *
     */
    componentDidMount(): void {
        this.props.overlay._registerElement(this);
    }

    /**
     *
     */
    componentDidUpdate(
        prevProps: Readonly<
            { overlay: ReactOverlay } & { worldPosition: vec3; scaleFactor?: number } & {
                children?: ReactNode | undefined;
            }
        >,
    ): void {
        if (
            prevProps.worldPosition.some((v, i) => v !== this.props.worldPosition[i]) ||
            prevProps.scaleFactor !== this.props.scaleFactor
        ) {
            this.props.overlay._updateElement();
        }
    }

    /**
     *
     */
    componentWillUnmount(): void {
        this.props.overlay._unregisterElement(this);
    }

    /**
     *
     */
    get screen_position(): vec3 {
        return this.state.screen_position;
    }

    /**
     *
     */
    get world_position(): vec3 {
        return this.props.worldPosition;
    }

    /**
     *
     */
    get scale_factor(): number | undefined {
        return this.props.scaleFactor;
    }

    /**
     *
     */
    setProjection(state: Projection & { z_index: number }): void {
        this.setState(state);
    }

    /**
     *
     */
    render(): ReactNode {
        if (!this.state.is_visible) {
            return null;
        }

        const transformStyle = `
            translate(-50%,-50%)
            translate(${this.state.screen_position[0]}px, ${this.state.screen_position[1]}px)`;

        return createPortal(
            <div
                style={{
                    position: "absolute",
                    transform: transformStyle,
                    zIndex: this.state.z_index,
                    pointerEvents: "auto",
                }}
            >
                {this.scale_factor ? (
                    <div style={{ transform: `scale(${this.state.scale})` }}>{this.props.children}</div>
                ) : (
                    this.props.children
                )}
            </div>,
            this.props.overlay.container,
        );
    }
}
