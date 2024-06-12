import { ReactNode } from "react";

//------------------------------------------------------------------------------
export const Output = ({ children }: { children: ReactNode }) => {
    return (
        <output className="flex items-center bg-color-underground bg-opacity-50 rounded-lg text-sm text-[#FFFFFFCC] divide-x divide-[#ffffff20] border border-[#ffffff20] backdrop-blur-xl">
            {children}
        </output>
    );
};

//------------------------------------------------------------------------------
export const OutputItem = ({ children }: { children: ReactNode }) => {
    return <p className="h-full flex items-center gap-2 px-4">{children}</p>;
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
        <span
            className={`inline-block text-right w-10 text-[#FFFFFF] ${isNumber ? "tabular-nums" : ""} ${className} }`}
        >
            {children}
        </span>
    );
};
