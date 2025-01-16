//------------------------------------------------------------------------------
import React, { Children, useEffect, useState, type PropsWithChildren } from "react";
import type { Entity, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export const ViewCube = ({
    cameraEntity,
    size = 100,
    perspective = "none",
    children,
}: PropsWithChildren<{ cameraEntity: Entity; size?: number; perspective?: string }>) => {
    const [cubeOrientation, setCubeOrientation] = useState<Vec3>([0, 0, 0]);

    useEffect(() => {
        const updateCubeOrientation = () => {
            const [x, y, z] = cameraEntity.local_transform!.eulerOrientation;
            setCubeOrientation([x, -y, z]);
        };

        cameraEntity.addEventListener("on-entity-updated", updateCubeOrientation);
        updateCubeOrientation();

        return () => {
            cameraEntity.removeEventListener("on-entity-updated", updateCubeOrientation);
        };
    }, [cameraEntity]);

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
