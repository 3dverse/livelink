import { useState } from "react";
import { CopyIcon } from "../icons/CopyIcon";
import { CheckIcon } from "../icons/CheckIcon";

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
            <button className={`relative button button-outline button-xs overflow-hidden transition-colors ${hasCopied ? "text-positive" : "text-tertiary"}`} onClick={onCopy}>
                {hasCopied && (
                    <CheckIcon className="absolute left-2 w-3 h-3 text-positive bg-ground animate-blur-in [--animation-duration:220ms] [animation-delay:20ms] opacity-0" />
                )}
                <CopyIcon className={`w-3 h-3 mr-2 ${hasCopied ? "animate-blur-out [--animation-duration:220ms]" : ""}`} />
                Copy
            </button>
        </div>
    );
};
