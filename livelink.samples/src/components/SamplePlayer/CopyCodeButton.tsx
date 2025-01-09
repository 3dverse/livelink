import { useState } from "react";

//------------------------------------------------------------------------------
export const CopyCodeButton = ({ code, className }: { code: string; className?: string }) => {
    const [hasCopied, setCopied] = useState<boolean>(false);

    const onCopy = () => {
        navigator.clipboard
            .writeText(code)
            .then(() => {
                setCopied(true);

                setTimeout(() => {
                    setCopied(false);
                }, 1500);
            })
            .catch(err => {
                console.error("Failed to copy text: ", err);
            });
    };
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <p
                className={`text-2xs tracking-wide text-positive [--animation-appear-offset:4px] opacity-0 ${hasCopied ? "animate-appear-top" : undefined}`}
            >
                Copied
            </p>
            <button className="button button-outline button-2xs" onClick={onCopy}>
                Copy
            </button>
        </div>
    );
};
