//------------------------------------------------------------------------------
import { useControls } from "leva";

//------------------------------------------------------------------------------
import type { SceneSettingsRecord, Vec3 } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    useSceneSettings,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "80ec3064-df96-41fa-be93-c6dbeb985278";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
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
        position: [0, 1.6, 9],
        settings: { volumetricLighting: true, debugLines: true },
    });

    const { sceneSettings } = useSceneSettings();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                {sceneSettings && (
                    <EnvironmentSettingsControls
                        sceneSettings={sceneSettings}
                    />
                )}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
type Rgb = { r: number; g: number; b: number };

const toRgb = ([r, g, b]: Vec3): Rgb => ({
    r: r * 255,
    g: g * 255,
    b: b * 255,
});
const toVec3 = ({ r, g, b }: Rgb): Vec3 => [r / 255, g / 255, b / 255];

//------------------------------------------------------------------------------
function EnvironmentSettingsControls({
    sceneSettings,
}: {
    sceneSettings: Readonly<SceneSettingsRecord>;
}) {
    const { environment, debug_lines } = sceneSettings;

    // Leva calls `onChange` once with the initial value too: only edits are
    // written to the scene.
    useControls("Environment settings", {
        ambientTop: {
            label: "ambient top",
            hint: "Color of the spherical gradient at the top of the sphere.",
            value: toRgb(environment.ambientColorTop),
            // A setting can be assigned a new value...
            onChange: (color: Rgb, _path, { initial }) => {
                if (!initial) environment.ambientColorTop = toVec3(color);
            },
        },
        ambientBottom: {
            label: "ambient bottom",
            hint: "Color of the spherical gradient at the bottom of the sphere.",
            value: toRgb(environment.ambientColorBottom),
            // ...or have its current value changed in place.
            onChange: (color: Rgb, _path, { initial }) => {
                if (initial) return;
                const [r, g, b] = toVec3(color);
                environment.ambientColorBottom[0] = r;
                environment.ambientColorBottom[1] = g;
                environment.ambientColorBottom[2] = b;
            },
        },
        drawLights: {
            label: "light debug lines",
            hint: "Draws debug lines for the lights in the scene.",
            value: debug_lines.drawLights,
            onChange: (drawLights: boolean, _path, { initial }) => {
                if (!initial) debug_lines.drawLights = drawLights;
            },
        },
    });

    return null;
}
