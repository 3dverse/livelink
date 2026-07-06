//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DEntityAnchor,
    CameraController,
    useCameraEntity,
    useEntity,
} from "@3dverse/livelink-react";
import { DOM3DAnchorLegend, LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "812f58e2-e735-484e-bf47-a7faf9e10128";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const STREET_LAMP_1_EUID = "423035fd-f021-48d9-8d2e-15d64afd6a96";
const STREET_LAMP_2_EUID = "424f56ae-14b8-4d07-9dcb-a7017ffb15ba";
const STREET_LAMP_3_EUID = "e3417e36-8e7a-4786-9008-734bea2ca059";
const CUBE_EUID = "1009e36c-07a1-47d0-90f7-a29496578c57";

//------------------------------------------------------------------------------
export function App() {
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

    const { entity: streetLamp1Entity } = useEntity({ euid: STREET_LAMP_1_EUID });
    const { entity: streetLamp2Entity } = useEntity({ euid: STREET_LAMP_2_EUID });
    const { entity: streetLamp3Entity } = useEntity({ euid: STREET_LAMP_3_EUID });
    const { entity: cubeEntity } = useEntity({ euid: CUBE_EUID });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    <DOM3DEntityAnchor entity={streetLamp1Entity} scaleFactor={0.005}>
                        <DOM3DAnchorLegend>Victorian street lamp</DOM3DAnchorLegend>
                    </DOM3DEntityAnchor>
                    <DOM3DEntityAnchor entity={streetLamp2Entity} scaleFactor={0.005}>
                        <DOM3DAnchorLegend>Victorian street lamp</DOM3DAnchorLegend>
                    </DOM3DEntityAnchor>
                    <DOM3DEntityAnchor entity={streetLamp3Entity} scaleFactor={0.005}>
                        <DOM3DAnchorLegend>Victorian street lamp</DOM3DAnchorLegend>
                    </DOM3DEntityAnchor>
                    <DOM3DEntityAnchor entity={cubeEntity} scaleFactor={0.005}>
                        <DOM3DAnchorLegend>Companion cube</DOM3DAnchorLegend>
                    </DOM3DEntityAnchor>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}
