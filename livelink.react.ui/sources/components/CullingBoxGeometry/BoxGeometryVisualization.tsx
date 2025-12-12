//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3, Viewport as LiveliveViewport, OverlayInterface } from "@3dverse/livelink";
import { ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export function BoxGeometryVisualization({
    boxGeometryEntity,
    boxColor,
    boxOpacity,
    edgeColor,
    edgeOpacity,
}: {
    boxGeometryEntity: Entity;
    boxColor: string;
    boxOpacity: number;
    edgeColor: string;
    edgeOpacity: number;
}) {
    const { viewport } = useContext(ViewportContext);
    const [overlay, setOverlay] = useState<BoxGeometryOverlay | null>(null);
    const [projectedVertices, setProjectedVertices] = useState<Vec3[]>([]);

    //--------------------------------------------------------------------------
    const sanitizedBoxOpacity = Math.min(Math.max(boxOpacity, 0), 1);
    const sanitizedEdgeOpacity = Math.min(Math.max(edgeOpacity, 0), 1);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!viewport) {
            return;
        }

        const overlay = new BoxGeometryOverlay({ viewport, setProjectedVertices });
        viewport.addOverlay({ overlay });
        setOverlay(overlay);

        return () => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!boxGeometryEntity.box_geometry) {
            console.warn("BoxGeometryVisualization: box_geometry or local_transform component not found.");
            return;
        }

        if (!overlay) {
            return;
        }

        const updateVisualization = () => {
            const globalTransform = boxGeometryEntity.global_transform;
            const boxGeometry = boxGeometryEntity.box_geometry!;

            overlay.setTransform({
                dimensions: boxGeometry.dimension,
                position: globalTransform.position,
                offset: boxGeometry.offset,
            });
        };

        boxGeometryEntity.addEventListener("on-entity-updated", updateVisualization);
        updateVisualization();

        return () => {
            boxGeometryEntity.removeEventListener("on-entity-updated", updateVisualization);
        };
    }, [overlay, boxGeometryEntity]);

    //--------------------------------------------------------------------------
    if (projectedVertices.length !== 8) {
        return null;
    }

    return (
        <svg
            className={styles.wireframe}
            fill={`color-mix(in srgb, ${boxColor}, transparent var(--opacity, ${100 - sanitizedBoxOpacity * 100}%))`}
            stroke={`color-mix(in srgb, ${edgeColor}, transparent ${100 - sanitizedEdgeOpacity * 100}%)`}
        >
            {BoxGeometryOverlay.facesIndices.map((indices, index) => (
                <polygon
                    key={index}
                    id={`face-${index}`}
                    points={indices.map(i => `${projectedVertices[i][0]},${projectedVertices[i][1]}`).join(" ")}
                    strokeWidth="1"
                    style={{
                        transitionProperty: "opacity, stroke",
                        transitionDuration: "0.2s",
                        transitionTimingFunction: "ease-in-out",
                    }}
                />
            ))}
        </svg>
    );
}

//------------------------------------------------------------------------------
class BoxGeometryOverlay implements OverlayInterface {
    /**
     *
     */
    #viewport: LiveliveViewport;

    /**
     *
     */
    #worldVertices: Vec3[] = [];

    /**
     *
     */
    #setProjectedVertices: (vertices: Vec3[]) => void;

    /**
     *
     */
    static readonly facesIndices = [
        // Bottom face
        [0, 1, 2, 3],
        // Top face
        [4, 5, 6, 7],
        // Side faces
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
    ] as const;

    /**
     *
     */
    static readonly edgesIndices = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0], // bottom face
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4], // top face
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7], // vertical edges
    ];

    /**
     *
     */
    constructor({
        viewport,
        setProjectedVertices,
    }: {
        viewport: LiveliveViewport;
        setProjectedVertices: (vertices: Vec3[]) => void;
    }) {
        this.#viewport = viewport;
        this.#setProjectedVertices = setProjectedVertices;
    }

    /**
     *
     */
    setTransform({ dimensions, position, offset }: { dimensions: Vec3; position: Vec3; offset: Vec3 }): void {
        const halfDim: Vec3 = [dimensions[0] * 0.5, dimensions[1] * 0.5, dimensions[2] * 0.5];
        const center: Vec3 = [position[0] + offset[0], position[1] + offset[1], position[2] + offset[2]];

        this.#worldVertices = [
            // Bottom face (z-)
            [center[0] - halfDim[0], center[1] - halfDim[1], center[2] - halfDim[2]], // 0: left-bottom-back
            [center[0] + halfDim[0], center[1] - halfDim[1], center[2] - halfDim[2]], // 1: right-bottom-back
            [center[0] + halfDim[0], center[1] + halfDim[1], center[2] - halfDim[2]], // 2: right-top-back
            [center[0] - halfDim[0], center[1] + halfDim[1], center[2] - halfDim[2]], // 3: left-top-back
            // Top face (z+)
            [center[0] - halfDim[0], center[1] - halfDim[1], center[2] + halfDim[2]], // 4: left-bottom-front
            [center[0] + halfDim[0], center[1] - halfDim[1], center[2] + halfDim[2]], // 5: right-bottom-front
            [center[0] + halfDim[0], center[1] + halfDim[1], center[2] + halfDim[2]], // 6: right-top-front
            [center[0] - halfDim[0], center[1] + halfDim[1], center[2] + halfDim[2]], // 7: left-top-front
        ];
    }

    /**
     *
     */
    draw(): null {
        if (!this.#viewport.camera_projection) {
            return null;
        }

        const projectedVertices = this.#worldVertices.map(worldVertex =>
            this.#viewport.projectWorldToScreen({ world_position: worldVertex }),
        );

        this.#setProjectedVertices(projectedVertices);
        return null;
    }

    /**
     *
     */
    resize(): void {
        // Force redraw on resize
        this.draw();
    }

    /**
     *
     */
    release(): void {}
}
