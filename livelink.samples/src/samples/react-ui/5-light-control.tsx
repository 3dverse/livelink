//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    CameraController,
    useEntity,
} from "@3dverse/livelink-react";
import {
    LightControl,
    LoadingOverlay,
    LightPreview,
    LightColorSelector,
    LightTemperatureSlider,
    LightBrightnessSlider,
    LightSwitchOnOff,
    useLightControl,
} from "@3dverse/livelink-react-ui";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "4a5ed051-d3c7-444d-9049-ce752af9748d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Light Control",
    summary: "A widget that lets you control the light",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            token={token}
            sceneId={scene_id}
            isTransient={true}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({
        settings: {
            ssr: true,
            volumetricLighting: true,
            density: 0.5,
        },
    });

    //--------------------------------------------------------------------------
    // Effects
    const { entity: light } = useEntity(
        { euid: "2716ab00-fc8a-4535-ac4f-8560962ba780" },
        ["point_light"],
    );

    //--------------------------------------------------------------------------
    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                {light && <LightControlWidget light={light} />}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function LightControlWidget({ light }: { light: Entity }) {
    return (
        <div
            className={`absolute bottom-[5vh] right-[5vh]
                bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)]
                backdrop-blur-xl rounded-lg shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)]
            `}
        >
            <LightControl light={light}>
                <LightControlInner />
            </LightControl>
        </div>
    );
}

//------------------------------------------------------------------------------
const LightControlInner = () => {
    const { isPowered } = useLightControl();
    return (
        <div className="flex gap-3 p-3 xl:p-4">
            <LightPreview />
            <div className="flex flex-col gap-4 flex-grow p-1">
                <div
                    className={`
                        flex flex-col gap-4 flex-grow transition-opacity duration-220
                        ${isPowered ? "" : "opacity-20 mix-blend-luminosity pointer-events-none"}
                    `}
                >
                    <LightColorSelector />
                    <div>
                        <label className="text-2xs text-tertiary mb-1">
                            Temperature
                        </label>
                        <LightTemperatureSlider />
                    </div>
                    <div>
                        <label className="text-2xs text-tertiary mb-1">
                            Brightness
                        </label>
                        <LightBrightnessSlider />
                    </div>
                </div>
                <div className="flex flex-col gap-4 flex-grow justify-end items-end transition-opacity duration-220">
                    <LightSwitchOnOff />
                </div>
            </div>
        </div>
    );
};