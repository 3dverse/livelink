//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Livelink, Session, Entity } from "@3dverse/livelink";
import type { UUID, Vec3 } from "@3dverse/livelink";

import {
    Livelink as LivelinkComponent,
    Canvas,
    Viewport,
    LivelinkContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "a896be32-2450-4dea-b59f-3c41901d7b0c";
const Space = [2, 2, 2] as const;
type SessionInfo = {
    session_id: UUID;
    token: string;
};

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Headless Client",
    summary: "A headless client for interacting with the 3D scene.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

    return (
        <>
            <Viewer setSessionInfo={setSessionInfo} />
            <HeadlessClient sessionInfo={sessionInfo} />
        </>
    );
}

//------------------------------------------------------------------------------
function Viewer({
    setSessionInfo,
}: {
    setSessionInfo: (sessionInfo: SessionInfo | null) => void;
}) {
    return (
        <LivelinkComponent
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
            isTransient={true}
        >
            <SessionSniffer setSessionInfo={setSessionInfo} />
            <AppLayout />
        </LivelinkComponent>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function SessionSniffer({
    setSessionInfo,
}: {
    setSessionInfo: (sessionInfo: SessionInfo | null) => void;
}) {
    const { instance } = useContext(LivelinkContext);
    useEffect(() => {
        setSessionInfo(
            instance
                ? {
                      session_id: instance.session.session_id,
                      token: instance.session.token,
                  }
                : null,
        );
        return () => setSessionInfo(null);
    }, [instance]);
    return null;
}

//------------------------------------------------------------------------------
function HeadlessClient({ sessionInfo }: { sessionInfo: SessionInfo | null }) {
    const [isStarted, setIsStarted] = useState(false);
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [entity, setEntity] = useState<Entity | null>(null);

    const [entityPosition, setEntityPosition] = useState<string | null>(null);
    const [entityOrientation, setEntityOrientation] = useState<string | null>(
        null,
    );

    const initializeLivelinkClient = useCallback(async () => {
        if (!sessionInfo) {
            throw new Error("Session info is not available");
        }

        const session = await Session.findById({
            session_id: sessionInfo.session_id,
            token: sessionInfo.token,
        });
        if (!session) {
            throw new Error("Session not found");
        }

        const instance = await Livelink.join({ session, is_headless: true });
        await instance.startHeadlessClient();
        return { instance };
    }, [sessionInfo]);

    useEffect(() => {
        if (!isStarted || !sessionInfo) {
            return;
        }

        let instance: Livelink | null = null;
        let isUnmounted = false;

        initializeLivelinkClient().then(({ instance: newInstance }) => {
            if (!isUnmounted) {
                instance = newInstance;
                setInstance(newInstance);
            } else {
                newInstance.disconnect();
            }
        });

        return () => {
            isUnmounted = true;
            instance?.disconnect();
            setInstance(null);
        };
    }, [isStarted, initializeLivelinkClient]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        createCube(instance).then(setEntity);

        return () => {
            setEntity(null);
        };
    }, [instance]);

    useEffect(() => {
        if (!entity) {
            return;
        }

        const speed = 1;
        const initial_position = Space.map(
            v => (Math.random() - 0.5) * v,
        ) as Vec3;
        const translation_axis = Space.map(
            v => (Math.random() - 0.5) * v,
        ) as Vec3;
        const rotation_axis = [
            360 * Math.random(),
            360 * Math.random(),
            360 * Math.random(),
        ];
        const sin_delay = Math.random() * 2 * Math.PI;

        const onUpdate = ({ elapsed_time }: { elapsed_time: number }) => {
            entity.local_transform!.position = translation_axis.map(
                (v, i) =>
                    initial_position[i] +
                    Math.sin(sin_delay + elapsed_time * speed) * v,
            ) as Vec3;

            entity.local_transform!.eulerOrientation = rotation_axis.map(
                v => Math.sin(sin_delay + elapsed_time * speed) * v,
            ) as Vec3;

            setEntityPosition(
                entity.local_transform.position
                    .map(v => v.toFixed(2))
                    .join(", "),
            );

            setEntityOrientation(
                entity.local_transform.eulerOrientation
                    .map(v => v.toFixed(2))
                    .join(", "),
            );
        };

        const start_time = Date.now();

        const interval = setInterval(() => {
            onUpdate({ elapsed_time: (Date.now() - start_time) / 1000 });
        }, 1000 / 60);

        return () => clearInterval(interval);
    }, [entity]);

    if (!sessionInfo) {
        return <p className="text-center">Start by creating a session</p>;
    }

    const status = isStarted
        ? instance
            ? "Headless client running..."
            : "Starting headless client..."
        : "Headless client stopped.";

    return (
        <div className="absolute bottom-2 right-2 flex flex-col items-end gap-2 w-1/4 h-1/4">
            <div className="bg-[black] text-[#00FF41] font-mono text-xs p-3 rounded-md shadow-lg w-full h-full overflow-y-auto">
                <p>{status}</p>
                {instance &&
                    (entity ? (
                        <>
                            <p>Cube entity is being updated.</p>
                            <br />
                            <p>{`Position: ${entityPosition}`}</p>
                            <p>{`Orientation: ${entityOrientation}`}</p>
                        </>
                    ) : (
                        <p>Creating cube entity...</p>
                    ))}
            </div>
            <button
                className="button button-primary mt-2"
                onClick={() => setIsStarted(prev => !prev)}
            >
                {isStarted ? "Stop headless client" : "Start headless client"}
            </button>
        </div>
    );
}

//------------------------------------------------------------------------------
async function createCube(instance: Livelink): Promise<Entity> {
    const initial_position = Space.map(v => (Math.random() - 0.5) * v) as Vec3;

    const entity = await instance.scene.newEntity({
        name: "Cube",
        components: {
            mesh_ref: { value: "0577814f-4677-420b-89e8-1e5a4dd56914" },
            local_transform: {
                position: initial_position,
            },
            material: {
                isDoubleSided: false,
                shaderRef: "f2a549e5-4f72-4cef-a5ab-48873c209e0c",
                constantsJSON: {
                    MATERIAL_UNTEXTURED: true,
                },
                dataJSON: {
                    albedo: [Math.random(), Math.random(), Math.random()],
                    emission: [0, 0, 0],
                },
            },
        },
        options: { delete_on_client_disconnection: true },
    });

    return entity;
}
