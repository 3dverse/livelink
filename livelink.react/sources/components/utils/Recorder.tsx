import React, { ReactNode, useContext, useEffect, useState } from "react";
import { CanvasContext } from "../core/Canvas";

/**
 * A React component that provides video recording functionality from a canvas element.
 *
 * @param params
 *
 * @param params.fileOptions - Configuration for the file picker when saving recordings
 * @param params.fileOptions.description - Human-readable description of the file type
 * @param params.fileOptions.accept - MIME type to file extension mapping for accepted file types
 * @param params.recorderOptions - Configuration options for the MediaRecorder
 * @param params.recorderOptions.mimeType - The MIME type and codecs for the recorded video
 * @param params.recorderOptions.videoBitsPerSecond - Target bit rate for video encoding
 * @param params.streamOptions - Configuration for the canvas stream capture
 * @param params.streamOptions.frameRequestRate - Desired frame rate for video capture
 * @param params.onSuccess - Callback function executed when recording is successfully completed and saved
 * @param params.onSuccess.filename - The name of the saved recording file
 * @param params.onCancel - Callback function executed when recording is cancelled by the user
 * @param params.children - Render function that receives recording state and returns React elements
 * @param params.children.recordTime - Current recording duration in seconds
 *
 * @category Components
 * @experimental
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
    onSuccess,
    onCancel,
    children,
}: {
    fileOptions?: FilePickerAcceptType;
    recorderOptions?: MediaRecorderOptions;
    streamOptions?: { frameRequestRate: number };
    onSuccess?: (filename: string) => void;
    onCancel?: () => void;
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
            window
                .showSaveFilePicker({ types: [fileOptions] })
                .then(async (fileHandle: FileSystemFileHandle) => {
                    const fileStream: FileSystemWritableFileStream = await fileHandle.createWritable();
                    mediaRecorder.ondataavailable = (event: BlobEvent): void => {
                        if (event.data.size > 0) {
                            fileStream.write(event.data);
                        }
                    };
                    mediaRecorder.onstop = (): void => {
                        fileStream.close();
                        if (onSuccess) {
                            onSuccess(fileHandle.name);
                        }
                    };
                    mediaRecorder.start();
                    setIsRecording(true);
                })
                .catch(error => {
                    // User cancelled the file picker
                    if (error.name === "AbortError") {
                        if (onCancel) {
                            onCancel();
                        }
                    } else {
                        console.error("File picker error:", error);
                    }
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
                setTimeout(() => {
                    // Check if recording was cancelled (no chunks collected)
                    if (chunks.length === 0) {
                        if (onCancel) {
                            onCancel();
                        }
                        return;
                    }

                    const filename = "recording.webm";

                    const blob = new Blob(chunks, { type: recorderOptions.mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.style.display = "none";
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    if (onSuccess) {
                        onSuccess(filename);
                    }
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
