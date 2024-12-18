//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera, useEntity } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { SunPositionPicker } from "@3dverse/livelink-react-ui";
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "bfadafe7-7d75-4e8d-ba55-3b65c4b1d994";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
const SUN_ENTITY_ID = "23e6b1cc-5e04-42c4-b179-12447556a170";

//------------------------------------------------------------------------------
class MyCameraWithAtmosphere extends DefaultCamera {
    onCreate() {
        super.onCreate();
        this.camera!.dataJSON!.atmosphere = true;
        this.camera!.dataJSON!.gradient = false;
    }
}
//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Sun Position Picker",
    summary: "A widget that lets you modify the sun position",
    element: (
        <Livelink
            token={token}
            sceneId={scene_id}
            isTransient={true}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <Canvas className={sampleCanvasClassName}>
                <Viewport className="w-full h-full">
                    <Camera class={MyCameraWithAtmosphere} name={"MyCamera"} />
                    <App />
                </Viewport>
            </Canvas>
        </Livelink>
    ),
};

//------------------------------------------------------------------------------
function App() {
    const { isPending, entity: theSun } = useEntity({ entity_uuid: SUN_ENTITY_ID });

    if (!isPending && !theSun) {
        return null;
    }

    return (
        <div className="absolute bottom-16 right-16 bg-ground rounded-xl opacity-90">
            <SunPositionPicker sun={theSun} />
        </div>
    );
}
