//------------------------------------------------------------------------------
import React, { createContext, useContext, useRef, useState } from "react";

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
    /* The color of the box */
    boxColor = "var(--3dverse-color-accent)",
    /* The opacity of the box color in the range of 0 to 1 */
    boxOpacity = 0.1,
    /* The color of the edges */
    edgeColor = "var(--3dverse-color-border-primary)",
    /* The opacity of the edges in the range of 0 to 1 */
    edgeOpacity = 0.9,
    children,
}: {
    initialSize?: Vec3;
    initialPosition?: Vec3;
    isActiveByDefault?: boolean;
    boxColor?: string;
    boxOpacity?: number;
    edgeColor?: string;
    edgeOpacity?: number;
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
                    <BoxGeometryHandles boxGeometryEntity={boxGeometryEntity} edgeColor={edgeColor} />
                    <BoxGeometryVisualization
                        boxGeometryEntity={boxGeometryEntity}
                        boxColor={boxColor}
                        boxOpacity={boxOpacity}
                        edgeColor={edgeColor}
                        edgeOpacity={edgeOpacity}
                    />
                </DOM3DOverlay>
            )}
            {children}
        </CullingBoxGeometryContext.Provider>
    );
};
