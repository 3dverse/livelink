//------------------------------------------------------------------------------
import { Entity, Vec3 } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    useEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "ced50bcf-6bbc-46d1-872a-dad99efdb8d6";

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Finding Entities",
    summary: "How to find multiples entities in one query.",
    useCustomLayout: true,
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
            isTransient={true}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({
        position: [0, 8, 15],
        settings: {
            gradient: false,
            skybox: true,
            grid: false,
            brightness: 0.1,
            ambientIntensity: 0.1,
            volumetricLighting: true,
            bloom: true,
            bloomStrength: 0.05,
            bloomThreshold: 0,
        },
    });
    const { entity: light1 } = useEntity(
        {
            euid: "82b75c7f-85f4-490c-9ae2-0f46fe271d79",
        },
        ["point_light"],
    );
    const { entity: light2 } = useEntity(
        {
            euid: "955dee9a-cdfa-4a57-8394-739dda2d1b4d",
        },
        ["point_light"],
    );
    const { entity: light3 } = useEntity(
        {
            euid: "dbd47a00-5e49-428b-9bb5-85bf9c5f5d7b",
        },
        ["point_light"],
    );
    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <div className="absolute top-6 right-6">
                    {[light1, light2, light3].map(light => {
                        if (light) {
                            return (
                                <LightComponent key={light.id} light={light} />
                            );
                        }
                    })}
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function LightComponent({ light }: { light: Entity }) {
    function toHex(c: number) {
        const hex = (c * 255).toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex(c: Vec3) {
        return "#" + toHex(c[0]) + toHex(c[1]) + toHex(c[2]);
    }

    function hexToRgb(h: string): Vec3 {
        return [
            parseInt(h.substring(0, 2), 16) / 255,
            parseInt(h.substring(2, 4), 16) / 255,
            parseInt(h.substring(4, 6), 16) / 255,
        ];
    }

    return (
        <div className="">
            <input
                type="color"
                className="p-1 h-10 w-14 block bg-white border border-gray-200 cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none"
                id="hs-color-input"
                value={rgbToHex(light.point_light!.color!)}
                title="Choose your color"
                onChange={e =>
                    (light.point_light!.color = hexToRgb(
                        e.target.value.substring(1),
                    ))
                }
            />
            <input
                type="range"
                min={0}
                max={100}
                value={light.point_light!.intensity!}
                onPointerDown={e => e.stopPropagation()}
                onPointerMove={e => e.stopPropagation()}
                onChange={e =>
                    (light.point_light!.intensity = Number(e.target.value))
                }
            />
            <button
                className="button button-primary"
                onClick={() => {
                    light.point_light = "default";
                }}
            >
                Reset
            </button>
        </div>
    );
}
