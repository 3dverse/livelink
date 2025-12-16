//------------------------------------------------------------------------------
import React, { useCallback, useState } from "react";
import { Recorder } from "@3dverse/livelink-react";
import { FaCheck, FaRegFileVideo } from "react-icons/fa6";

//------------------------------------------------------------------------------
import { Button, Size } from "../../components-common/Button";
import { Tooltip } from "../../components-common/Tooltip";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const VideoRecorder = ({
    label = "Record video",
    recordingLabel = "",
    successLabel = "Video saved",
    size = "md",
}: {
    label?: string;
    recordingLabel?: string;
    successLabel?: string;
    size?: Exclude<Size, "3xs" | "2xs">;
}) => {
    //--------------------------------------------------------------------------
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isVideoSaved, setIsVideoSaved] = useState<boolean>(false);
    const [savedFileName, setSavedFileName] = useState<string | null>(null);

    //--------------------------------------------------------------------------
    const getHeight = useCallback((): string => {
        switch (size) {
            case "xs":
                return "1.5em";
            case "sm":
                return "2em";
            case "md":
                return "2.5em";
            default:
                return "2.5em";
        }
    }, [size]);

    //--------------------------------------------------------------------------
    const onSuccess = useCallback((filename: string) => {
        setIsVideoSaved(true);
        setSavedFileName(filename);

        setTimeout(() => {
            setIsVideoSaved(false);
            setSavedFileName(null);
        }, 3500);
    }, []);

    //--------------------------------------------------------------------------
    const onCancel = useCallback(() => {
        setIsRecording(false);
    }, []);

    //--------------------------------------------------------------------------
    return (
        <div className={`${styles.container} ${styles[`size-${size}`]}`}>
            {isRecording && (
                <Recorder onCancel={onCancel} onSuccess={onSuccess}>
                    {({ recordTime }: { recordTime: number }) => (
                        <time className={`${styles.time} livelink-animation-appear-right`}>
                            {secondToTimeString(recordTime)}
                        </time>
                    )}
                </Recorder>
            )}
            {isVideoSaved ? (
                <>
                    <p
                        style={{ height: getHeight() }}
                        className={`${styles.successLabel} livelink-animation-appear-right`}
                    >
                        <FaRegFileVideo className={styles.fileIcon} />
                        <span className={styles.ellipsis}>{savedFileName}</span>
                        <span style={{ marginLeft: "1px" }}>.webm</span>
                    </p>
                    <Tooltip
                        isVisible
                        isDisabled={successLabel === ""}
                        content={successLabel}
                        offset={0}
                        variant="positive"
                    >
                        <span className={`${styles.successIcon} livelink-animation-appear-top`}>
                            <FaCheck style={{ fontSize: "0.9em" }} />
                        </span>
                    </Tooltip>
                </>
            ) : (
                <Button
                    onClick={() => setIsRecording(prev => !prev)}
                    size={size}
                    style={{
                        height: getHeight(),
                        flexGrow: 1,
                        gap: ".8em",
                        borderLeft: isRecording
                            ? "1px solid var(--3dverse-color-border-secondary)"
                            : "1px solid transparent",
                    }}
                >
                    <span
                        className={styles.icon}
                        style={{
                            boxShadow: isRecording ? "none" : undefined,
                            borderRadius: isRecording ? "0" : undefined,
                        }}
                    />
                    {isRecording ? recordingLabel : label}
                </Button>
            )}
        </div>
    );
};

//------------------------------------------------------------------------------
function secondToTimeString(seconds: number): string {
    const date = new Date(seconds * 1000);
    return date.toISOString().substring(11, 19);
}
