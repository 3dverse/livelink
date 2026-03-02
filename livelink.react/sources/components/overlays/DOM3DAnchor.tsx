//------------------------------------------------------------------------------
import React, { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";
import { mat4, vec2, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import { CameraProjection, Mat4, Vec2, Vec3, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { useDOM3DOverlay } from "../../contexts/OverlayContext";
import { DOM3DElementProjection, getObjectCSSMatrix, PointProjection } from "../../overlays/DOM3DElementProjection";
import { DOM3DOverlayContainer } from "../../overlays/DOM3DOverlayContainer";

/**
 *
 */
export type AnchorOffset =
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
 * @deprecated Use `AnchorOffset` instead.
 */
export type Anchor = AnchorOffset;

/**
 *
 */
export type DOM3DAnchorProps = PropsWithChildren<
    {
        /**
         * The world position of the 3D anchor.
         */
        worldPosition: Vec3;

        /**
         * The anchor point of the element relative to its screen position.
         * For example, "left-top" will position the element such that its left-top corner is at the
         * projected screen position of the world coordinates.
         * Defaults to "center".
         */
        offset?: AnchorOffset;

        /**
         * Whether to scale the element based on its distance from the camera.
         */
        scaleFactor?: number;

        /**
         * The ref of the container element.
         */
        containerRef?: React.Ref<HTMLDivElement>;

        /**
         * Callback fired when the projection of the world position changes, providing the new
         * screen position, z-index, and scale.
         */
        onProjectionChange?: (projections: Readonly<PointProjection>) => void;
    } & React.HTMLAttributes<HTMLDivElement> &
        React.DOMAttributes<HTMLDivElement>
>;

/**
 * A component that renders a <div> anchored to a provided world space position.
 *
 * @category Components
 */
export function DOM3DAnchor(props: DOM3DAnchorProps): React.JSX.Element | null {
    const { children, containerRef, ...otherProps } = props;
    const overlay = useDOM3DOverlay();

    if (!overlay) {
        return null;
    }

    return (
        <React3DAnchor overlay={overlay} containerRef={containerRef} {...otherProps}>
            {children}
        </React3DAnchor>
    );
}

/**
 * @deprecated Use `DOM3DAnchor` instead.
 */
export function DOM3DElement(props: DOM3DAnchorProps & { anchor?: AnchorOffset }): React.JSX.Element | null {
    return <DOM3DAnchor offset={props.anchor} {...props} />;
}

/**
 *
 */
type HorizontalAnchorOffset = "left" | "center" | "right";

/**
 *
 */
type VerticalAnchorOffset = "top" | "center" | "bottom";

/**
 * A React component that renders a <div> anchored to a provided world space position, using
 * a ReactOverlay for projection.
 *
 * @internal
 */
export class React3DAnchor
    extends React.Component<{ overlay: DOM3DOverlayContainer } & DOM3DAnchorProps, { transform_style: string }>
    implements DOM3DElementProjection
{
    /**
     *
     */
    static VerticalAnchorPositions: Record<VerticalAnchorOffset, number> = {
        top: 50,
        center: 0,
        bottom: -50,
    };

    /**
     *
     */
    static HorizontalAnchorPositions: Record<HorizontalAnchorOffset, number> = {
        left: 50,
        center: 0,
        right: -50,
    };

    /**
     *
     */
    #local_to_world_matrix: Mat4 = mat4.create() as Mat4;

    /**
     *
     */
    #projection: PointProjection = {
        screen_position: vec3.create() as Vec3,
        is_visible: false,
    };

    /**
     *
     */
    #translation: Vec2 = vec2.create() as Vec2;

    /**
     *
     */
    state = {
        transform_style: "",
    };

    /**
     *
     */
    constructor(props: { overlay: DOM3DOverlayContainer } & DOM3DAnchorProps) {
        super(props);
    }

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
            { overlay: DOM3DOverlayContainer } & DOM3DAnchorProps & {
                    children?: ReactNode | undefined;
                }
        >,
    ): void {
        if (prevProps.offset !== this.props.offset) {
            this.#updateTranslation();
            this.props.overlay._redraw();
            return;
        }

        if (
            prevProps.worldPosition[0] !== this.props.worldPosition[0] ||
            prevProps.worldPosition[1] !== this.props.worldPosition[1] ||
            prevProps.worldPosition[2] !== this.props.worldPosition[2] ||
            prevProps.scaleFactor !== this.props.scaleFactor
        ) {
            this.props.overlay._redraw();
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
    #updateTranslation(): void {
        const offset = this.props.offset;
        if (!offset || offset === "center") {
            return;
        }

        const [anchor_x, anchor_y] = offset.split("-") as [HorizontalAnchorOffset, VerticalAnchorOffset];
        this.#translation[0] = React3DAnchor.HorizontalAnchorPositions[anchor_x];
        this.#translation[1] = React3DAnchor.VerticalAnchorPositions[anchor_y];
    }

    /**
     *
     */
    updateProjection({ viewport }: { viewport: Viewport }): void {
        if (!viewport.camera_projection) {
            return;
        }

        this.#computeTransformStyle(viewport.camera_projection);

        if (this.props.onProjectionChange) {
            viewport.projectWorldToScreen({
                world_position: this.props.worldPosition,
                out_screen_position: this.#projection.screen_position,
            });

            this.#projection.is_visible =
                this.#projection.screen_position[2] < 1.0 && this.#projection.screen_position[2] > 0;
            this.props.onProjectionChange(this.#projection);
        }
    }

    /**
     *
     */
    #computeTransformStyle(camera_projection: CameraProjection): void {
        // https://swiftcoder.wordpress.com/2008/11/25/constructing-a-billboard-matrix/
        mat4.transpose(this.#local_to_world_matrix, camera_projection.view_from_world_matrix);

        // Apply position
        this.#local_to_world_matrix[12] = this.props.worldPosition[0];
        this.#local_to_world_matrix[13] = this.props.worldPosition[1];
        this.#local_to_world_matrix[14] = this.props.worldPosition[2];

        let scaleFactor: number;
        if (this.props.scaleFactor) {
            // Use provided scale factor
            scaleFactor = this.props.scaleFactor;
        } else {
            // Compute scale to maintain constant size regardless of distance
            // Calculate distance from camera to world position
            const cameraPosVec = camera_projection.world_position;
            const worldPos = this.props.worldPosition;

            const dx = worldPos[0] - cameraPosVec[0];
            const dy = worldPos[1] - cameraPosVec[1];
            const dz = worldPos[2] - cameraPosVec[2];
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            scaleFactor = distance * 0.001;
        }

        mat4.scale(this.#local_to_world_matrix, this.#local_to_world_matrix, [scaleFactor, scaleFactor, 1]);

        this.#local_to_world_matrix[3] = 0;
        this.#local_to_world_matrix[7] = 0;
        this.#local_to_world_matrix[11] = 0;
        this.#local_to_world_matrix[15] = 1;

        const transformStyle = getObjectCSSMatrix(this.#local_to_world_matrix);

        this.#projection.is_visible = true;
        this.setState({ transform_style: transformStyle });
    }

    /**
     *
     */
    render(): ReactNode {
        if (!this.#projection.is_visible) {
            return null;
        }

        const {
            children,
            style,
            containerRef,
            worldPosition: _,
            onProjectionChange: __,
            offset: ___,
            overlay: ____,
            scaleFactor: _____,
            ...otherContainerProps
        } = this.props;

        return createPortal(
            <div
                ref={containerRef}
                style={{
                    position: "absolute",
                    pointerEvents: "auto",
                    transform: this.state.transform_style,
                    ...style,
                }}
                {...otherContainerProps}
            >
                {this.props.offset && this.props.offset !== "center" ? (
                    <div
                        role="offset-anchor"
                        style={{
                            transform: `translate(${this.#translation[0]}%, ${this.#translation[1]}%)`,
                        }}
                    >
                        {children}
                    </div>
                ) : (
                    children
                )}
            </div>,
            this.props.overlay.dom_3d_element,
        );
    }
}
