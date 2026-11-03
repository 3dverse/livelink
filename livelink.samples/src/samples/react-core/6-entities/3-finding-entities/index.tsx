//------------------------------------------------------------------------------
import { useEffect } from "react";
import { button, useControls } from "leva";

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
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "ced50bcf-6bbc-46d1-872a-dad99efdb8d6";

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
                {[light1, light2, light3].map(
                    (light, index) =>
                        light && (
                            <LightControls
                                key={light.id}
                                light={light}
                                name={`light ${index + 1}`}
                            />
                        ),
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
function LightControls({ light, name }: { light: Entity; name: string }) {
    const color = light.point_light!.color!;
    const intensity = light.point_light!.intensity!;

    const [, setControls] = useControls(
        name,
        () => ({
            // Called when the light moves the controls too: only edits are
            // written to it.
            color: {
                value: toRgb(color),
                onChange: (value: Rgb, _path, { fromPanel }) => {
                    if (fromPanel) light.point_light!.color = toVec3(value);
                },
            },
            intensity: {
                value: intensity,
                min: 0,
                max: 100,
                onChange: (value: number, _path, { fromPanel }) => {
                    if (fromPanel) light.point_light!.intensity = value;
                },
            },
            reset: button(() => {
                light.point_light = "default";
            }),
        }),
        [light],
    );

    // The controls follow the light, which Reset changes.
    useEffect(() => {
        setControls({ color: toRgb(color), intensity });
    }, [color, intensity, setControls]);

    return null;
}
