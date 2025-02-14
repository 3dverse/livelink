//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    useEntity,
    DOM3DOverlay,
    DOMEntity,
    LivelinkContext,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";
import { useCallback, useContext, useEffect, useState } from "react";
import { ScriptEventReceived, UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "916fe9f3-0d7c-4044-b659-7d9fa883b586";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Script Events",
    summary: "Script events for custom interactions.",
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
    const { instance } = useContext(LivelinkContext);

    const { entity: textEntity } = useEntity({
        euid: "8886cac1-325e-4359-8722-9d784f5e65f0",
    });

    const { entity: goToNPC } = useEntity({
        euid: "aed087a6-c6b5-47a7-8de5-d7ce71678cb4",
    });

    const { entity: goToStart } = useEntity({
        euid: "c33dff81-9761-4571-87fe-bf53cd368e0d",
    });

    const { entity: trigger } = useEntity({
        euid: "1275a4fc-45b1-4b44-8d27-174a0e310368",
    });

    const [text, setText] = useState("");
    const [currentState, setCurrentState] = useState(0);

    const onTriggerEntered = useCallback(
        (e: ScriptEventReceived) => {
            if (!instance || !trigger) {
                return;
            }

            const hEntity = e.data_object.hEntity as {
                originalEUID: UUID;
                linkage: UUID[];
            };

            instance.scene
                .findEntity({
                    entity_uuid: hEntity.originalEUID,
                    linkage: hEntity.linkage,
                })
                .then(entity => {
                    trigger.material!.dataJSON.albedo = [0, 1, 0];

                    setTimeout(() => {
                        setText(`Hello, ${entity?.name}`);
                    }, 500);
                });
        },
        [instance, trigger],
    );

    const onTriggerExited = useCallback(
        (_e: ScriptEventReceived) => {
            if (!trigger) {
                return;
            }

            trigger.material!.dataJSON.albedo = [1, 0, 0];
        },
        [trigger],
    );

    useEffect(() => {
        if (!instance) {
            return;
        }
        instance.startSimulation();
    }, [instance]);

    useEffect(() => {
        if (!trigger) {
            return;
        }

        const event_map_id = "7a8cc05e-8659-4b23-99d1-1352d13e2020";
        trigger.addScriptEventListener({
            event_map_id,
            event_name: "enter_trigger",
            onReceived: onTriggerEntered,
        });

        trigger.addScriptEventListener({
            event_map_id,
            event_name: "exit_trigger",
            onReceived: onTriggerExited,
        });

        return () => {
            trigger.removeScriptEventListener({
                event_map_id,
                event_name: "enter_trigger",
                onReceived: onTriggerEntered,
            });
            trigger.removeScriptEventListener({
                event_map_id,
                event_name: "exit_trigger",
                onReceived: onTriggerExited,
            });
        };
    }, [trigger]);

    const { cameraEntity } = useCameraEntity({
        position: [-1, 1.8, 1.8],
        eulerOrientation: [-14, -62, 0],
        settings: {
            grid: false,
            skybox: true,
            gradient: false,
        },
    });

    const goToNextState = useCallback(
        (state: number) => {
            if (
                !goToNPC ||
                !goToStart ||
                !goToNPC.animation_sequence_controller ||
                !goToStart.animation_sequence_controller
            ) {
                return;
            }

            switch (state) {
                case 0:
                    goToNPC.animation_sequence_controller.playState = 1;
                    break;

                case 1:
                    setText("What's up?");
                    break;

                case 2:
                    setText("");
                    goToStart.animation_sequence_controller.playState = 1;
                    break;
            }

            setCurrentState((state + 1) % 3);
        },
        [goToNPC, goToStart],
    );

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    {text && (
                        <DOMEntity entity={textEntity} scaleFactor={0.0025}>
                            <div className="relative rounded-lg bg-informative-100 text-primary-dark p-2 translate-x-10 max-w-md opacity-80">
                                <p>{text}</p>
                                <button
                                    className="button button-overlay mt-4 absolute right-4"
                                    onClick={() => goToNextState(currentState)}
                                >
                                    Next
                                </button>
                            </div>
                        </DOMEntity>
                    )}
                </DOM3DOverlay>
            </Viewport>
            {currentState === 0 && (
                <button
                    className="absolute top-4 left-4 button button-overlay"
                    onClick={() => goToNextState(currentState)}
                >
                    Action
                </button>
            )}
        </Canvas>
    );
}
