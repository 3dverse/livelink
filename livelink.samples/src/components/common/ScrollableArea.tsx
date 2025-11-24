//------------------------------------------------------------------------------
import { ReactNode } from "react";

//------------------------------------------------------------------------------
export const ScrollableArea = ({
    ref,
    children,
    className,
    ...divProps
}: {
    ref: React.RefObject<HTMLDivElement>;
    children: ReactNode;
    className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
    return (
        <div ref={ref} className={`scrollable-area ${className ?? ""}`} {...divProps}>
            <div className="scrollable-up" />
            {children}
            <div className="scrollable-down" />
        </div>
    );
};
