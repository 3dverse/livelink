//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    Recorder,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";
import { useState } from "react";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Recording",
    summary: "Record a video of the scene.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();
    const [enableRecording, setEnableRecording] = useState(false);

    return (
        <Canvas className="max-h-screen">
            <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                {enableRecording && (
                    <Recorder onCancel={() => setEnableRecording(false)}>
                        {({ recordTime }: { recordTime: number }) => (
                            <time className="flex flex-col items-center px-6 py-2 text-sm tracking-wider tabular-nums bg-ground rounded-full shadow-md">
                                {secondToTimeString(recordTime)}
                            </time>
                        )}
                    </Recorder>
                )}
                <button
                    className="button button-primary gap-3"
                    onClick={() => setEnableRecording(prev => !prev)}
                >
                    <span
                        className={`bg-[tomato] w-3 h-3 transition-all ${enableRecording ? "" : "rounded-full"}`}
                    />
                    {enableRecording ? "Stop" : "Start"} recording
                </button>
            </div>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function secondToTimeString(seconds: number): string {
    const date = new Date(seconds * 1000);
    return date.toISOString().substring(11, 19);
}
