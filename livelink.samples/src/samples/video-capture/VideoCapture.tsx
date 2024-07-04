//------------------------------------------------------------------------------
import { useRef, useState } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import { Camera, EncodedFrameConsumer, Livelink, Viewport, VirtualSurface } from "@3dverse/livelink";

//------------------------------------------------------------------------------
class VideoWriter extends EncodedFrameConsumer {
    #file_handle: FileSystemFileHandle | null = null;
    #stream: FileSystemWritableFileStream | null = null;
    #bytesWritten: number = 0;

    async configure(): Promise<VideoWriter> {
        this.#file_handle = await window.showSaveFilePicker();
        this.#stream = await this.#file_handle!.createWritable();
        return this;
    }

    consumeEncodedFrame({ encoded_frame }: { encoded_frame: DataView }): void {
        this.#bytesWritten += encoded_frame.byteLength;
        this.#stream?.write(encoded_frame.buffer);
    }

    release() {
        console.log(`Written ${this.#bytesWritten} bytes`);
        this.#stream?.close();
    }
}

/**
 * Re-encode hevc raw file to mp4:
 * ffmpeg -f hevc -i test.hevc -c copy test.mp4
 */

//------------------------------------------------------------------------------
export default function VideoCapture() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [recording, setRecording] = useState(false);
    const cameraRef = useRef<string | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });
    const { instance: instance2, connect: connect2, disconnect: disconnect2 } = useLivelinkInstance({ views: [] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" }).then(v => {
                cameraRef.current = v?.cameras.at(0)?.id ?? null;
            });
        }
    };

    const toggleRecording = async () => {
        if (recording) {
            if (instance2) {
                disconnect2();
            }
            setRecording(false);
        } else {
            connect2({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
                token: "public_p54ra95AMAnZdTel",
                onConfigureClient: async (inst: Livelink) => {
                    const viewports = [new Viewport(inst, new VirtualSurface(1920, 1080))];

                    inst.addViewports({ viewports });

                    await inst.configureRemoteServer({ codec: 2 });

                    // Step 3: configure the local client.
                    await inst.setEncodedFrameConsumer({
                        encoded_frame_consumer: new VideoWriter(),
                    });

                    inst.session.clients.map(c => console.log(c.camera_rtids));

                    console.log({ CAM: cameraRef.current });
                    if (!cameraRef.current) {
                        return;
                    }
                    const camera = await inst.scene.findEntity(Camera, { entity_uuid: cameraRef.current });
                    console.log({ camera });
                    if (camera) {
                        camera.viewport = viewports[0];
                        viewports[0].camera = camera;
                    }
                },
            });
            setRecording(true);
        }
    };

    return (
        <div className="relative h-full p-3 lg:pl-0">
            <Canvas canvasRef={canvasRef} />

            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
                {instance && (
                    <button className="button button-primary" onClick={toggleRecording}>
                        {recording ? "Stop" : "Start"} Recording
                    </button>
                )}
            </CanvasActionBar>
        </div>
    );
}
