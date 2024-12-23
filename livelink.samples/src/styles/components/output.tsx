//------------------------------------------------------------------------------
import { ReactNode } from "react";

//------------------------------------------------------------------------------
export const Output = ({ children }: { children: ReactNode }) => {
    return (
        <output className="absolute top-5 right-5 py-2 flex flex-col gap-1 bg-underground bg-opacity-50 rounded-lg text-xs text-[#FFFFFFCC] divide-x divide-[#ffffff20] border border-[#ffffff20] backdrop-blur-xl">
            {children}
        </output>
    );
};

//------------------------------------------------------------------------------
export const OutputTitle = ({ children }: { children: ReactNode }) => {
    return <header className="px-3 py-1 text-3xs font-semibold tracking-wider uppercase opacity-90">{children}</header>;
};

//------------------------------------------------------------------------------
export const OutputItem = ({ children }: { children: ReactNode }) => {
    return <p className="h-full flex items-center justify-between gap-1 px-3">{children}</p>;
};

//------------------------------------------------------------------------------
export const OutputDivider = () => {
    return <hr />;
};

//------------------------------------------------------------------------------
export const OutputValue = ({
    isNumber,
    className,
    children,
}: {
    isNumber?: boolean;
    className?: string;
    children: ReactNode;
}) => {
    return (
        <span className={`inline-block text-right w-8 text-[white] ${isNumber ? "tabular-nums" : ""} ${className} }`}>
            {children}
        </span>
    );
};
