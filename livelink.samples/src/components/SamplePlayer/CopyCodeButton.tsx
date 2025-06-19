import { useState } from "react";
import { CopyIcon } from "../icons/CopyIcon";

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
                console.debug("Failed to copy text: ", err);
                __onCopy();
            });
    };

    /**
     * Old fashioned way to copy text to clipboard, in case the navigator.clipboard API is not available
     */
    const __onCopy = () => {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand("copy");
            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 1500);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        } finally {
            document.body.removeChild(textArea);
        }
    };

    //--------------------------------------------------------------------------
    return (
        <div className={`flex items-center gap-2 ${className ?? ""}`}>
            <p
                className={`text-2xs tracking-wide text-positive [--animation-appear-offset:4px] opacity-0 ${hasCopied ? "animate-appear-top" : undefined}`}
            >
                Copied
            </p>
            <button className="button button-outline button-xs" onClick={onCopy}>
                <CopyIcon className="w-3 h-3 mr-2" />
                Copy
            </button>
        </div>
    );
};
