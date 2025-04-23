import React, { ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { CanvasContext } from "../core/Canvas";

/**
 * @experimental
 *
 * Recorder component for recording video from a canvas.
 *
 * @category Components
 */
export function Recorder({
    fileOptions = {
        description: "Video recording",
        accept: {
            "video/webm": [".webm"],
        },
    },
    recorderOptions = {
        mimeType: `video/webm; codecs="vp8"`,
        videoBitsPerSecond: 10000000,
    },
    streamOptions = {
        frameRequestRate: 30,
    },
    children,
}: {
    fileOptions?: FilePickerAcceptType;
    recorderOptions?: MediaRecorderOptions;
    streamOptions?: { frameRequestRate: number };
    children?: (props: { recordTime: number }) => ReactNode;
}): ReactNode {
    const { renderingSurface } = useContext(CanvasContext);
    const [recordTime, setRecordTime] = useState(0);
    const [isRecording, setIsRecording] = useState(false);

    const mediaRecorder = useMemo(() => {
        if (!renderingSurface) {
            return null;
        }

        const stream = renderingSurface.canvas.captureStream(streamOptions.frameRequestRate);
        return new MediaRecorder(stream, recorderOptions);
    }, [renderingSurface]);

    useEffect(() => {
        if (!mediaRecorder) {
            return;
        }

        window.showSaveFilePicker({ types: [fileOptions] }).then(async (fileHandle: FileSystemFileHandle) => {
            const fileStream: FileSystemWritableFileStream = await fileHandle.createWritable();
            mediaRecorder.ondataavailable = (event: BlobEvent): void => {
                if (event.data.size > 0) {
                    fileStream.write(event.data);
                }
            };
            mediaRecorder.onstop = (): void => {
                fileStream.close();
            };
            mediaRecorder.start();
            setIsRecording(true);
        });

        return (): void => {
            mediaRecorder.stop();
        };
    }, [mediaRecorder]);

    useEffect(() => {
        if (!isRecording) {
            return;
        }

        const interval = setInterval(() => {
            setRecordTime((prev: number) => prev + 1);
        }, 1000);

        return (): void => clearInterval(interval);
    }, [isRecording]);

    return <>{children ? children({ recordTime }) : null}</>;
}
