//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, useCameraEntity, CameraController } from "@3dverse/livelink-react";
import { ViewCube, InactivityWarning } from "@3dverse/livelink-react-ui";
import type { Components, Entity, Vec3 } from "@3dverse/livelink";
import { Object3D } from "three";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "6391ff06-c881-441d-8ada-4184b2050751";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "View Cube",
    summary: "A cube that represents the camera direction.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
            InactivityWarningPanel={InactivityWarning}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                {cameraEntity && (
                    <div className="absolute bottom-4 right-4 m-4">
                        <StyledViewCube cameraEntity={cameraEntity} />
                    </div>
                )}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function StyledViewCube({ cameraEntity }: { cameraEntity: Entity }) {
    const setCameraPosition = (position: Vec3) => {
        const local_transform = cameraEntity.local_transform as Required<Components.LocalTransform>;

        const lookAt = (target: Vec3): Vec3 => {
            const camera = new Object3D();
            camera.position.set(target[0], target[1], target[2]);
            camera.lookAt(position[0], position[1], position[2]);

            return [camera.rotation.x, camera.rotation.y, camera.rotation.z].map(radianToDegree) as Vec3;
        };

        local_transform.eulerOrientation = lookAt([0, 0, 0]);
        local_transform.position = position;
    };

    const cubeSize = 100;
    const cubeFace = `border-2 border-[#000] font-bold text-[#fff] text-center cursor-pointer`;
    const commonStyle = { width: cubeSize, height: cubeSize, lineHeight: `${cubeSize}px` };
    const radius = 5;
    return (
        <ViewCube cameraEntity={cameraEntity} size={cubeSize} perspective={"600px"}>
            <div
                className={cubeFace}
                style={{ ...commonStyle, background: "hsla(  0, 100%, 50%, 0.7)" }}
                onClick={() => setCameraPosition([0, 0, radius])}
            >
                Front
            </div>
            <div
                className={cubeFace}
                style={{ ...commonStyle, background: "hsla( 60, 100%, 50%, 0.7)" }}
                onClick={() => setCameraPosition([0, 0, -radius])}
            >
                Back
            </div>
            <div
                className={cubeFace}
                style={{ ...commonStyle, background: "hsla(120, 100%, 50%, 0.7)" }}
                onClick={() => setCameraPosition([radius, 0, 0])}
            >
                Right
            </div>
            <div
                className={cubeFace}
                style={{ ...commonStyle, background: "hsla(180, 100%, 50%, 0.7)" }}
                onClick={() => setCameraPosition([-radius, 0, 0])}
            >
                Left
            </div>
            <div
                className={cubeFace}
                style={{ ...commonStyle, background: "hsla(240, 100%, 50%, 0.7)" }}
                onClick={() => setCameraPosition([0, radius, 0])}
            >
                Top
            </div>
            <div
                className={cubeFace}
                style={{ ...commonStyle, background: "hsla(300, 100%, 50%, 0.7)" }}
                onClick={() => setCameraPosition([0, -radius, 0])}
            >
                Bottom
            </div>
        </ViewCube>
    );
}

//------------------------------------------------------------------------------
const radianToDegree = (radian: number): number => (radian * 180) / Math.PI;
