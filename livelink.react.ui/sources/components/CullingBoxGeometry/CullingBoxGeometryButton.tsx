//------------------------------------------------------------------------------
import React from "react";

//------------------------------------------------------------------------------
import { useCullingBoxGeometry } from ".";

//------------------------------------------------------------------------------
export const CullingBoxGeometryButton = ({
    children,
}: {
    children: React.ReactNode | ((props: { isActive: boolean; toggle: () => void }) => React.ReactNode);
}) => {
    const { isActive, toggle } = useCullingBoxGeometry();

    if (typeof children === "function") {
        return <>{children({ isActive, toggle })}</>;
    }

    if (React.isValidElement(children)) {
        const element = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void; isActive?: boolean }>;
        return React.cloneElement(element, {
            onClick: (e: React.MouseEvent) => {
                toggle();
                if (element.props.onClick) {
                    element.props.onClick(e);
                }
            },
            isActive,
        });
    }

    return <>{children}</>;
};
