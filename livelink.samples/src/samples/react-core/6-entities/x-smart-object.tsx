//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";
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
const scene_id = "80ec3064-df96-41fa-be93-c6dbeb985278";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Smart Object",
    summary: "Link an entity to a React component.",
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
        settings: { volumetricLighting: true },
    });
    const { entity: light } = useEntity(
        {
            euid: "a9b10115-a52b-459b-9660-e67ea8155fbe",
        },
        ["point_light"],
    );

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                {light && <LightComponent light={light} />}
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
        <div className="absolute top-6 left-6">
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
                max={10}
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
