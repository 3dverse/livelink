import React, { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ReactOverlay, Projection } from "./ReactOverlay";
import { Vec2, Vec3 } from "@3dverse/livelink";

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
export type React3DElementProps = PropsWithChildren<
    {
        /**
         * The world position of the 3D element.
         */
        worldPosition: Vec3;

        /**
         * Where to anchor the element relative to its position.
         */
        anchor?: Anchor;

        /**
         * Whether to scale the element based on its distance from the camera.
         */
        scaleFactor?: number;

        /**
         * The ref of the container element.
         */
        containerRef?: React.Ref<HTMLDivElement>;

        /**
         *
         */
        onProjectionChange?: (projection: Projection & { z_index: number }) => void;
    } & React.HTMLAttributes<HTMLDivElement> &
        React.DOMAttributes<HTMLDivElement>
>;

/**
 * @internal
 */
export class React3DElement extends React.Component<
    { overlay: ReactOverlay } & React3DElementProps,
    { screen_position: Vec3; z_index: number; scale: number; is_visible: boolean; translation: Vec2 }
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
        screen_position: [0, 0, 0] as Vec3,
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
    get screen_position(): Vec3 {
        return this.state.screen_position;
    }

    /**
     *
     */
    get world_position(): Vec3 {
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
        this.props.onProjectionChange?.(state);
    }

    /**
     *
     */
    #updateTranslation(): void {
        const anchor = this.props.anchor || "center";
        if (anchor === "center") {
            this.setState({
                translation: [
                    React3DElement.HorizontalAnchorPositions.center,
                    React3DElement.VerticalAnchorPositions.center,
                ],
            });
            return;
        }

        const [anchor_x, anchor_y] = anchor.split("-") as [HorizontalAnchor, VerticalAnchor];
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

        const {
            children,
            style,
            containerRef,
            worldPosition: _,
            onProjectionChange: __,
            ...otherContainerProps
        } = this.props;

        return createPortal(
            <div
                ref={containerRef}
                style={{
                    position: "absolute",
                    transform: transformStyle,
                    zIndex: this.state.z_index,
                    pointerEvents: "auto",
                    ...style,
                }}
                {...otherContainerProps}
            >
                {this.scale_factor ? (
                    <div style={{ transform: `scale(${this.state.scale})` }}>{children}</div>
                ) : (
                    children
                )}
            </div>,
            this.props.overlay.container,
        );
    }
}
