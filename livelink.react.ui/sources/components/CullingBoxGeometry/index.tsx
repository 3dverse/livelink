//------------------------------------------------------------------------------
import React, { createContext, useContext, useState } from "react";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";
import { useEntity, DOM3DOverlay } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { BoxGeometryHandles } from "./BoxGeometryHandles";
import { BoxGeometryVisualization } from "./BoxGeometryVisualization";

//------------------------------------------------------------------------------
type CullingBoxGeometryContextType = {
    isActive: boolean;
    toggle: () => void;
};

//------------------------------------------------------------------------------
const CullingBoxGeometryContext = createContext<CullingBoxGeometryContextType | null>(null);

//------------------------------------------------------------------------------
export const useCullingBoxGeometry = () => {
    const ctx = useContext(CullingBoxGeometryContext);
    if (!ctx) throw new Error("useCullingBoxGeometry must be used within <CullingBoxGeometry>");
    return ctx;
};

//------------------------------------------------------------------------------
export const CullingBoxGeometry = ({
    initialSize = [1, 1, 1],
    initialPosition = [0, 0, 0],
    isActiveByDefault = true,
    boxColor = "#ffff00",
    opacity = 0.2,
    edgeColor = "#000000",
    children,
}: {
    initialSize?: Vec3;
    initialPosition?: Vec3;
    isActiveByDefault?: boolean;
    boxColor?: string;
    opacity?: number;
    edgeColor?: string;
    children?: React.ReactNode;
}) => {
    const [isEnable, setEnableState] = useState(isActiveByDefault);

    const { entity: boxGeometryEntity } = useEntity(
        {
            name: "Box Geometry",
            components: {
                local_transform: { position: initialPosition },
                box_geometry: { dimension: initialSize },
                culling_geometry: {},
            },
            options: { delete_on_client_disconnection: true },
        },
        ["local_transform", "box_geometry"],
    );

    const toggle = () => setEnableState(!isEnable);

    return (
        <CullingBoxGeometryContext.Provider value={{ isActive: isEnable, toggle }}>
            {boxGeometryEntity && isEnable && (
                <DOM3DOverlay>
                    <BoxGeometryVisualization
                        boxGeometryEntity={boxGeometryEntity}
                        boxColor={boxColor}
                        opacity={opacity}
                        edgeColor={edgeColor}
                    />
                    <BoxGeometryHandles boxGeometryEntity={boxGeometryEntity} />
                </DOM3DOverlay>
            )}
            {children}
        </CullingBoxGeometryContext.Provider>
    );
};
