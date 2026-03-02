//------------------------------------------------------------------------------
import React, { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";
import { mat4, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import type { Mat4, Vec3, Vec4 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { useDOM3DOverlay } from "../../contexts/OverlayContext";
import { DOM3DOverlayContainer } from "../../overlays/DOM3DOverlayContainer";
import { getObjectCSSMatrix } from "../../overlays/DOM3DElementProjection";
import type { StrictUnion } from "../../utils";

/**
 *
 */
export type Quad = [Vec3, Vec3, Vec3, Vec3];

/**
 *
 */
type QuadProp =
    | StrictUnion<
          | {
                eq: Vec4;
                width: number;
                height: number;
            }
          | {
                tl: Vec3;
                tr: Vec3;
                br: Vec3;
                bl: Vec3;
            }
      >
    | [Vec3, Vec3, Vec3, Vec3];

/**
 *
 */
export type DOM3DDivProps = PropsWithChildren<
    {
        /**
         * The world position of the 3D element.
         */
        worldQuad: QuadProp;

        /**
         *
         */
        worldUnitToPixelScale?: number;

        /**
         * The width and height of the quad in world units.
         * If not provided, the dimensions will be computed from the world quad.
         * Providing dimensions can be an optimization if the world quad is a perfect rectangle and
         * the dimensions are known, as it avoids unnecessary computations.
         */
        dimensions?: {
            width: number;
            height: number;
        };

        /**
         * The ref of the container element.
         */
        containerRef?: React.Ref<HTMLDivElement>;
    } & React.HTMLAttributes<HTMLDivElement> &
        React.DOMAttributes<HTMLDivElement>
>;

/**
 * A component that renders a 3D div.
 *
 * @category Components
 * @experimental
 */
export function DOM3DDiv(props: DOM3DDivProps): React.JSX.Element | null {
    const { children, containerRef, ...otherProps } = props;
    const overlay = useDOM3DOverlay();

    if (!overlay) {
        return null;
    }

    return (
        <React3DDivElement overlay={overlay} containerRef={containerRef} {...otherProps}>
            {children}
        </React3DDivElement>
    );
}

/**
 * @internal
 */
interface React3DDivElementState {
    pixelWidth: number;
    pixelHeight: number;
    transform: string;
}

/**
 * @internal
 */
export class React3DDivElement extends React.Component<
    { overlay: DOM3DOverlayContainer } & DOM3DDivProps,
    React3DDivElementState
> {
    /**
     *
     */
    #local_to_world_matrix: Mat4 = mat4.create() as Mat4;

    /**
     *
     */
    #world_quad: Quad = [vec3.create(), vec3.create(), vec3.create(), vec3.create()] as Quad;

    /**
     * Pre-allocated vectors for matrix computations
     */
    #temp_center: vec3 = vec3.create();
    #temp_right_vec: vec3 = vec3.create();
    #temp_down_vec: vec3 = vec3.create();
    #temp_forward_vec: vec3 = vec3.create();
    #temp_scale_vec: vec3 = vec3.create();

    /**
     *
     */
    state: React3DDivElementState = {
        pixelWidth: 0,
        pixelHeight: 0,
        transform: "",
    };

    /**
     *
     */
    constructor(props: { overlay: DOM3DOverlayContainer } & DOM3DDivProps) {
        super(props);
    }

    /**
     *
     */
    componentDidMount(): void {
        this.#updateState();
    }

    /**
     *
     */
    componentDidUpdate(prevProps: Readonly<DOM3DDivProps>): void {
        if (this.#havePropsChanged(prevProps, this.props)) {
            this.#updateState();
        }
    }

    /**
     *
     */
    #updateState(): void {
        this.#computeWorldQuad();
        this.#computeQuadPixelDimensions();
        this.#computeWorldMatrix();

        this.forceUpdate();
    }

    /**
     *
     */
    render(): ReactNode {
        const {
            children,
            style,
            containerRef,
            worldQuad: _,
            overlay: ___,
            worldUnitToPixelScale: ____,
            dimensions: _____,
            ...otherContainerProps
        } = this.props;

        return createPortal(
            <div
                ref={containerRef}
                role="dom3d-div"
                style={{
                    position: "absolute",
                    pointerEvents: "auto",
                    width: this.state.pixelWidth,
                    height: this.state.pixelHeight,
                    transform: this.state.transform,
                    ...style,
                }}
                {...otherContainerProps}
            >
                {children}
            </div>,
            this.props.overlay.dom_3d_element,
        );
    }

    /**
     * Computes the world quad from the given world quad data.
     */
    #computeWorldQuad(): void {
        if (Array.isArray(this.props.worldQuad)) {
            this.#world_quad = this.props.worldQuad as Quad;
        } else if ("eq" in this.props.worldQuad) {
            const { eq, width, height } = this.props.worldQuad as { eq: Vec4; width: number; height: number };
            const [a, b, c, d] = eq;
            const center: Vec3 = [a * width, b * height, c * width];
            const right: Vec3 = [d * width, 0, 0];
            const down: Vec3 = [0, -d * height, 0];

            this.#world_quad[0] = center;
            this.#world_quad[1] = [center[0] + right[0], center[1] + right[1], center[2] + right[2]];
            this.#world_quad[2] = [
                center[0] + right[0] + down[0],
                center[1] + right[1] + down[1],
                center[2] + right[2] + down[2],
            ];
            this.#world_quad[3] = [center[0] + down[0], center[1] + down[1], center[2] + down[2]];
        } else {
            this.#world_quad[0] = this.props.worldQuad.tl;
            this.#world_quad[1] = this.props.worldQuad.tr;
            this.#world_quad[2] = this.props.worldQuad.br;
            this.#world_quad[3] = this.props.worldQuad.bl;
        }
    }

    /**
     * Computes the world transformation matrix from the world quad data.
     */
    #computeWorldMatrix(): void {
        const [tl, tr, br, bl] = this.#world_quad;

        // Calculate center position (average of all corners)
        vec3.add(this.#temp_center, tl as vec3, tr as vec3);
        vec3.add(this.#temp_center, this.#temp_center, br as vec3);
        vec3.add(this.#temp_center, this.#temp_center, bl as vec3);
        vec3.scale(this.#temp_center, this.#temp_center, 0.25);

        // Calculate right vector (tl to tr)
        vec3.subtract(this.#temp_right_vec, tr as vec3, tl as vec3);
        vec3.normalize(this.#temp_right_vec, this.#temp_right_vec);

        // Calculate down vector (tl to bl)
        vec3.subtract(this.#temp_down_vec, bl as vec3, tl as vec3);
        vec3.normalize(this.#temp_down_vec, this.#temp_down_vec);

        // Calculate forward vector (cross product of right and down)
        vec3.cross(this.#temp_forward_vec, this.#temp_right_vec, this.#temp_down_vec);
        vec3.normalize(this.#temp_forward_vec, this.#temp_forward_vec);

        // Set rotation matrix (normalized basis vectors)
        mat4.set(
            this.#local_to_world_matrix,
            this.#temp_right_vec[0],
            this.#temp_right_vec[1],
            this.#temp_right_vec[2],
            0,
            this.#temp_down_vec[0],
            this.#temp_down_vec[1],
            this.#temp_down_vec[2],
            0,
            this.#temp_forward_vec[0],
            this.#temp_forward_vec[1],
            this.#temp_forward_vec[2],
            0,
            this.#temp_center[0],
            this.#temp_center[1],
            this.#temp_center[2],
            1,
        );

        // Apply scale - scale down by the pixel scale factor
        // Similar to THREE.js: scale = worldSize / pixelToUnitScale
        const pixelToUnitScale = this.props.worldUnitToPixelScale ?? 100;
        vec3.set(this.#temp_scale_vec, 1 / pixelToUnitScale, -1 / pixelToUnitScale, 1);
        mat4.scale(this.#local_to_world_matrix, this.#local_to_world_matrix, this.#temp_scale_vec);

        this.state.transform = getObjectCSSMatrix(this.#local_to_world_matrix);
    }

    /**
     *
     */
    #computeQuadPixelDimensions(): void {
        if (this.props.dimensions !== undefined) {
            this.state.pixelWidth = this.props.dimensions.width;
            this.state.pixelHeight = this.props.dimensions.height;
        } else {
            // TOP LEFT to TOP RIGHT vector
            const dx1 = this.#world_quad[1][0] - this.#world_quad[0][0];
            const dy1 = this.#world_quad[1][1] - this.#world_quad[0][1];
            const dz1 = this.#world_quad[1][2] - this.#world_quad[0][2];

            // BOTTOM LEFT to TOP LEFT vector
            const dx2 = this.#world_quad[3][0] - this.#world_quad[0][0];
            const dy2 = this.#world_quad[3][1] - this.#world_quad[0][1];
            const dz2 = this.#world_quad[3][2] - this.#world_quad[0][2];

            this.state.pixelWidth = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1);
            this.state.pixelHeight = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
        }

        this.state.pixelWidth *= this.props.worldUnitToPixelScale ?? 100;
        this.state.pixelHeight *= this.props.worldUnitToPixelScale ?? 100;
    }

    /**
     *
     */
    #havePropsChanged(prevProps: DOM3DDivProps, nextProps: DOM3DDivProps): boolean {
        if (prevProps.worldUnitToPixelScale !== nextProps.worldUnitToPixelScale) {
            return true;
        }

        if (
            prevProps.dimensions?.width !== nextProps.dimensions?.width ||
            prevProps.dimensions?.height !== nextProps.dimensions?.height
        ) {
            return true;
        }

        function vec3Equals(vecA: Vec3, vecB: Vec3): boolean {
            return vecA[0] === vecB[0] && vecA[1] === vecB[1] && vecA[2] === vecB[2];
        }

        const pq = prevProps.worldQuad;
        const nq = nextProps.worldQuad;

        const wasArray = Array.isArray(pq);
        const isArray = Array.isArray(nq);
        if (wasArray !== isArray) {
            return true;
        } else if (isArray && wasArray) {
            for (let i = 0; i < 4; i++) {
                if (!vec3Equals((pq as Quad)[i], (nq as Quad)[i])) {
                    return true;
                }
            }
            return false;
        }

        const wasPlane = "eq" in pq;
        const isPlane = "eq" in nq;
        if (wasPlane !== isPlane) {
            return true;
        } else if (wasPlane && isPlane) {
            const pp = pq as { eq: Vec4; width: number; height: number };
            const np = nq as { eq: Vec4; width: number; height: number };
            if (pp.width !== np.width || pp.height !== np.height) {
                return true;
            }

            for (let i = 0; i < 4; i++) {
                if (pp.eq[i] !== np.eq[i]) {
                    return true;
                }
            }
            return false;
        }

        const wasTLBR = "tl" in pq;
        const isTLBR = "tl" in nq;
        if (wasTLBR !== isTLBR) {
            return true;
        } else if (wasTLBR && isTLBR) {
            const ptq = pq as { tl: Vec3; tr: Vec3; br: Vec3; bl: Vec3 };
            const ntq = nq as { tl: Vec3; tr: Vec3; br: Vec3; bl: Vec3 };
            if (
                !vec3Equals(ptq.tl, ntq.tl) ||
                !vec3Equals(ptq.tr, ntq.tr) ||
                !vec3Equals(ptq.br, ntq.br) ||
                !vec3Equals(ptq.bl, ntq.bl)
            ) {
                return true;
            }
            return false;
        }

        return false;
    }
}
