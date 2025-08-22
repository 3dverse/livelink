import React, { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";
import { vec3 } from "gl-matrix";
import type { ReactOverlay, Projection } from "./ReactOverlay";
import { Vec2 } from "@3dverse/livelink";

/**
 *
 */
export type Anchor =
    | "left-top"
    | "left-center"
    | "left-bottom"
    | "center-top"
    | "center"
    | "center-bottom"
    | "right-top"
    | "right-center"
    | "right-bottom";

/**
 *
 */
type HorizontalAnchor = "left" | "center" | "right";

/**
 *
 */
type VerticalAnchor = "top" | "center" | "bottom";

/**
 *
 */
export type React3DElementProps = PropsWithChildren<{
    worldPosition: vec3;
    anchor: Anchor;
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
    { screen_position: vec3; z_index: number; scale: number; is_visible: boolean; translation: Vec2 }
> {
    /**
     *
     */
    static VerticalAnchorPositions: Record<VerticalAnchor, number> = {
        top: 0,
        center: -50,
        bottom: -100,
    };

    /**
     *
     */
    static HorizontalAnchorPositions: Record<HorizontalAnchor, number> = {
        left: 0,
        center: -50,
        right: -100,
    };

    /**
     *
     */
    state = {
        screen_position: vec3.create(),
        z_index: 0,
        scale: 1,
        is_visible: false,
        translation: [0, 0] as Vec2,
    };

    /**
     *
     */
    componentDidMount(): void {
        this.#updateTranslation();
        this.props.overlay._registerElement(this);
    }

    /**
     *
     */
    componentDidUpdate(
        prevProps: Readonly<
            { overlay: ReactOverlay } & React3DElementProps & {
                    children?: ReactNode | undefined;
                }
        >,
    ): void {
        if (
            prevProps.worldPosition[0] !== this.props.worldPosition[0] ||
            prevProps.worldPosition[1] !== this.props.worldPosition[1] ||
            prevProps.worldPosition[2] !== this.props.worldPosition[2] ||
            prevProps.anchor !== this.props.anchor ||
            prevProps.scaleFactor !== this.props.scaleFactor
        ) {
            this.#updateTranslation();
            this.props.overlay._updateElement();
        }
    }

    /**
     *
     */

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
    #updateTranslation(): void {
        if (this.props.anchor === "center") {
            this.setState({
                translation: [
                    React3DElement.HorizontalAnchorPositions.center,
                    React3DElement.VerticalAnchorPositions.center,
                ],
            });
            return;
        }

        const [anchor_x, anchor_y] = this.props.anchor.split("-") as [HorizontalAnchor, VerticalAnchor];

        this.setState({
            translation: [
                React3DElement.HorizontalAnchorPositions[anchor_x],
                React3DElement.VerticalAnchorPositions[anchor_y],
            ],
        });
    }

    /**
     *
     */
    render(): ReactNode {
        if (!this.state.is_visible) {
            return null;
        }

        const transformStyle = `
            translate(${this.state.translation[0]}%, ${this.state.translation[1]}%)
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
