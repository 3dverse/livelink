import React, { ReactNode, useContext, useEffect, useState } from "react";
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

    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

    // Create MediaRecorder only once per renderingSurface change
    useEffect(() => {
        if (!renderingSurface) {
            setMediaRecorder(null);
            return;
        }

        type FireFoxCanvas = HTMLCanvasElement & { mozCaptureStream: (frameRate?: number) => MediaStream };

        let mediaStream: MediaStream | null = null;
        if (typeof renderingSurface.canvas.captureStream === "function") {
            mediaStream = renderingSurface.canvas.captureStream(streamOptions.frameRequestRate);
        } else if (typeof (renderingSurface.canvas as FireFoxCanvas).mozCaptureStream === "function") {
            mediaStream = (renderingSurface.canvas as FireFoxCanvas).mozCaptureStream(streamOptions.frameRequestRate);
        }

        if (!mediaStream) {
            setMediaRecorder(null);
            return;
        }

        try {
            const recorder = new MediaRecorder(mediaStream, recorderOptions);
            setMediaRecorder(recorder);
        } catch {
            setMediaRecorder(null);
        }
    }, [renderingSurface]);

    useEffect(() => {
        if (!mediaRecorder) {
            return;
        }

        if ("showSaveFilePicker" in window) {
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
        } else {
            // Fallback for browsers without showSaveFilePicker (e.g., Firefox)
            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (event: BlobEvent): void => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            mediaRecorder.onstop = (): void => {
                // Firefox workaround: sometimes onstop is called before last chunk is available
                // Wait a tick to ensure all data is collected
                console.log("Recording stopped, processing chunks...");
                setTimeout(() => {
                    const blob = new Blob(chunks, { type: recorderOptions.mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.style.display = "none";
                    a.href = url;
                    a.download = "recording.webm";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            };
            mediaRecorder.start();
            setIsRecording(true);
        }

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
