//------------------------------------------------------------------------------
import React, { Children, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { ViewportContext } from "@3dverse/livelink-react";
import type { OverlayInterface, Vec3, Viewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const ViewCube = ({
    size = 100,
    perspective = "none",
    viewport: propsViewport,
    children,
}: PropsWithChildren<{ size?: number; perspective?: string; viewport?: Viewport }>) => {
    const { viewport: contextViewport } = useContext(ViewportContext);
    const [cubeOrientation, setCubeOrientation] = useState<Vec3>([0, 0, 0]);

    const viewport = propsViewport || contextViewport;

    useEffect(() => {
        if (!viewport) {
            return;
        }

        const overlay = new ViewCubeOverlay({
            viewport,
            setCubeOrientation,
        });

        viewport.addOverlay({ overlay });

        return () => {
            viewport.removeOverlay({ overlay });
        };
    }, [viewport]);

    if (Children.count(children) !== 6) {
        throw new Error("CameraCubeWidget must have exactly 6 children");
    }

    const childrenArray = Children.toArray(children);

    return (
        <>
            <style>
                {`
                    .scene {
                        width: ${size}px;
                        height: ${size}px;
                        perspective: ${perspective};
                    }

                    .cube {
                        width: 100%;
                        height: 100%;
                        position: relative;
                        transform-style: preserve-3d;
                        transform: translateZ(-${size}px);
                    }

                    .cube__face {
                        position: absolute;
                        width: ${size}px;
                        height: ${size}px;
                        cursor: pointer;
                    }

                    .cube__face--bottom {
                        box-shadow: 0px 0px 31px 10px #381e1e5f;
                    }

                    .cube__face--front  { transform: rotateY(  0deg) translateZ(${Math.floor(size * 0.5)}px); }
                    .cube__face--right  { transform: rotateY( 90deg) translateZ(${Math.floor(size * 0.5)}px); }
                    .cube__face--back   { transform: rotateY(180deg) translateZ(${Math.floor(size * 0.5)}px); }
                    .cube__face--left   { transform: rotateY(-90deg) translateZ(${Math.floor(size * 0.5)}px); }
                    .cube__face--top    { transform: rotateX( 90deg) translateZ(${Math.floor(size * 0.5)}px); }
                    .cube__face--bottom { transform: rotateX(-90deg) translateZ(${Math.floor(size * 0.5)}px); }
                `}
            </style>
            <div className="scene">
                <div
                    className="cube"
                    style={{
                        transform: `rotateX(${cubeOrientation[0]}deg) rotateY(${cubeOrientation[1]}deg) rotateZ(${cubeOrientation[2]}deg)`,
                    }}
                >
                    <div className="cube__face cube__face--front">{childrenArray[0]}</div>
                    <div className="cube__face cube__face--back">{childrenArray[1]}</div>
                    <div className="cube__face cube__face--right">{childrenArray[2]}</div>
                    <div className="cube__face cube__face--left">{childrenArray[3]}</div>
                    <div className="cube__face cube__face--top">{childrenArray[4]}</div>
                    <div className="cube__face cube__face--bottom">{childrenArray[5]}</div>
                </div>
            </div>
        </>
    );
};

//------------------------------------------------------------------------------
class ViewCubeOverlay implements OverlayInterface {
    #viewport: Viewport;
    #setCubeOrientation: (orientation: Vec3) => void;

    constructor({
        viewport,
        setCubeOrientation,
    }: {
        viewport: Viewport;
        setCubeOrientation: (orientation: Vec3) => void;
    }) {
        this.#viewport = viewport;
        this.#setCubeOrientation = setCubeOrientation;
    }

    draw(): null {
        if (!this.#viewport.camera_projection) {
            return null;
        }

        const [x, y, z] = this.#viewport.camera_projection.world_euler_orientation;
        this.#setCubeOrientation([x, -y, z]);
        return null;
    }

    resize(): void {}
    release(): void {}
}
