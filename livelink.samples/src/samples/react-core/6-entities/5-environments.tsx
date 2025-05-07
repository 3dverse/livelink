//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    CameraController,
    useEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";
import { AssetRef, Assets } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "b3b18edb-0e1b-419e-afdf-0fe3096a172e";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Scene Environment",
    summary: "Shows how to set up a scene environment with a skybox",
    element: <App />,
};

//------------------------------------------------------------------------------
const environments: Record<
    string,
    {
        skybox: AssetRef<Assets.Cubemap>;
        radiance: AssetRef<Assets.Cubemap>;
        irradiance: AssetRef<Assets.Cubemap>;
    }
> = {
    ["Clarens Midday"]: {
        skybox: "cf968355-142a-49d6-a1fe-77b4e46f684e",
        radiance: "f62ad645-2700-4971-8e01-fabec124e668",
        irradiance: "723b95b5-f3bf-4313-a913-f6c4c365b72f",
    },
    ["Evening Road"]: {
        skybox: "eb6b6cfc-a25f-4f9b-9cbf-287488a5f902",
        radiance: "2abf3b02-7ce9-437c-a85f-5f2f54ecc67b",
        irradiance: "ff345697-eca6-4970-bec7-7e6b1d52c715",
    },
    ["Autumn Forest"]: {
        skybox: "a26e639d-c45b-41c6-bd76-29a15d10ee74",
        radiance: "b807c4b8-0632-4f8f-857b-49c355dd273d",
        irradiance: "49d35aef-78b9-4d95-898c-f55343af8334",
    },
} as const;

//------------------------------------------------------------------------------
function App() {
    return (
        <>
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                isTransient={true}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <AppLayout />
            </Livelink>
        </>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({
        settings: { grid: true, skybox: true },
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <EnvironmentSelector />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function EnvironmentSelector() {
    const { entity: environment } = useEntity({
        name: "Environment",
        components: {
            environment: {},
        },
    });

    const [selectedEnvironment, setSelectedEnvironment] = useState<
        keyof typeof environments
    >(Object.keys(environments)[0]);

    useEffect(() => {
        if (!environment || !environment.environment) {
            return;
        }

        const selectedSkybox = environments[selectedEnvironment];

        environment.environment.skyboxUUID = selectedSkybox.skybox;
        environment.environment.radianceUUID = selectedSkybox.radiance;
        environment.environment.irradianceUUID = selectedSkybox.irradiance;
    }, [environment, selectedEnvironment]);

    return (
        <div className="absolute bottom-4 flex items-center w-full justify-center">
            <select
                className="select select-primary min-w-[20rem]"
                value={selectedEnvironment}
                onChange={event =>
                    setSelectedEnvironment(
                        event.target.value as keyof typeof environments,
                    )
                }
            >
                {Object.keys(environments).map(item => (
                    <option key={item} value={item}>
                        {item}
                    </option>
                ))}
            </select>
        </div>
    );
}
