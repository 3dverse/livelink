//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";
import meta from "./meta.json";

//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    LivelinkContext,
    useCameraEntity,
    CameraController,
    useEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, SamplePlayer } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "d19ecb53-6488-48c1-a085-fab7de85b189";

//------------------------------------------------------------------------------
export function App() {
    const [sessionInfo, setSessionInfo] = useState<{
        session_id: UUID;
        camera_entity_id: UUID;
    } | null>(null);

    return (
        <div className="relative flex w-full h-full">
            <SessionCreator setSessionInfo={setSessionInfo} />
            <SessionFollower sessionInfo={sessionInfo} />
        </div>
    );
}

//------------------------------------------------------------------------------
function SessionCreator({
    setSessionInfo,
}: {
    setSessionInfo: (
        sessionInfo: {
            session_id: UUID;
            camera_entity_id: UUID;
        } | null,
    ) => void;
}) {
    return (
        <SamplePlayer
            autoConnect={false}
            title="Create Session"
            summary={meta.summary}
        >
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
                autoJoinExisting={false}
            >
                <AppLayout setSessionInfo={setSessionInfo} />
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function SessionFollower({
    sessionInfo,
}: {
    sessionInfo: {
        session_id: UUID;
        camera_entity_id: UUID;
    } | null;
}) {
    if (!sessionInfo) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full">
                <p className="text-center">Start by creating a session</p>
            </div>
        );
    }

    return (
        <SamplePlayer
            autoConnect={false}
            title="Join Session"
            summary="Follow the camera from the created session"
        >
            <Livelink
                sessionId={sessionInfo.session_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <FollowerLayout cameraEntityId={sessionInfo.camera_entity_id} />
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function AppLayout({
    setSessionInfo,
}: {
    setSessionInfo: (
        sessionInfo: {
            session_id: UUID;
            camera_entity_id: UUID;
        } | null,
    ) => void;
}) {
    const { instance } = useContext(LivelinkContext);
    const { cameraEntity } = useCameraEntity();

    useEffect(() => {
        if (instance && cameraEntity) {
            setSessionInfo({
                session_id: instance.session.session_id,
                camera_entity_id: cameraEntity.id,
            });
        }
    }, [instance, cameraEntity, setSessionInfo]);

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
const FollowerLayout = ({ cameraEntityId }: { cameraEntityId: UUID }) => {
    const { entity: camera } = useEntity({ euid: cameraEntityId });

    return (
        <Canvas className="w-full h-full">
            <Viewport className="w-full h-full" cameraEntity={camera} />
        </Canvas>
    );
};
