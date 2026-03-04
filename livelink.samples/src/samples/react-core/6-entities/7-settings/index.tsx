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
                    <EnvironmentSettingsComponent
                        sceneSettings={sceneSettings}
                    />
                )}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function EnvironmentSettingsComponent({
    sceneSettings,
}: {
    sceneSettings: Readonly<SceneSettingsRecord>;
}) {
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
            <div className="bg-linear-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold text-lg tracking-wide">
                        🎨 Environment Settings
                    </h3>
                    <div className="w-8 h-8 bg-linear-to-r from-purple-500 to-pink-500 rounded-full opacity-80"></div>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200">
                    <div className="shrink-0">
                        <span className="text-2xl">✨</span>
                    </div>
                    <div className="flex-1">
                        <label
                            htmlFor="hs-color-ambient-top-input"
                            className="text-white font-semibold text-sm tracking-wide drop-shadow-lg block mb-1"
                        >
                            Top Spherical Ambient
                        </label>
                        <p className="text-gray-300 text-xs w-60">
                            Color of the spherical gradient at the top of the
                            sphere.
                        </p>
                    </div>
                    <input
                        type="color"
                        className="p-1 h-12 w-16 block bg-white border-2 border-white/20 cursor-pointer rounded-xl disabled:opacity-50 disabled:pointer-events-none shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200"
                        id="hs-color-ambient-top-input"
                        value={rgbToHex(
                            sceneSettings.environment.ambientColorTop,
                        )}
                        title="Choose your color"
                        onChange={e =>
                            (sceneSettings.environment.ambientColorTop =
                                hexToRgb(e.target.value.substring(1)))
                        }
                    />
                </div>

                <div className="flex items-center space-x-4 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200">
                    <div className="shrink-0">
                        <span className="text-2xl">🌅</span>
                    </div>
                    <div className="flex-1">
                        <label
                            htmlFor="hs-color-ambient-bottom-input"
                            className="text-white font-semibold text-sm tracking-wide drop-shadow-lg block mb-1"
                        >
                            Bottom Spherical Ambient
                        </label>
                        <p className="text-gray-300 text-xs w-60">
                            Color of the spherical gradient at the bottom of the
                            sphere.
                        </p>
                    </div>
                    <input
                        type="color"
                        className="p-1 h-12 w-16 block bg-white border-2 border-white/20 cursor-pointer rounded-xl disabled:opacity-50 disabled:pointer-events-none shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200"
                        id="hs-color-ambient-bottom-input"
                        value={rgbToHex(
                            sceneSettings.environment.ambientColorBottom,
                        )}
                        title="Choose your color"
                        onChange={e => {
                            const color = hexToRgb(e.target.value.substring(1));
                            const ambientColorBottomReference =
                                sceneSettings.environment.ambientColorBottom;

                            ambientColorBottomReference[0] = color[0];
                            ambientColorBottomReference[1] = color[1];
                            ambientColorBottomReference[2] = color[2];
                        }}
                    />
                </div>

                <div className="flex items-center space-x-4 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200">
                    <div className="shrink-0">
                        <span className="text-2xl">💡</span>
                    </div>
                    <div className="flex-1">
                        <label
                            htmlFor="hs-color-clear-color-input"
                            className="text-white font-semibold text-sm tracking-wide drop-shadow-lg block mb-1"
                        >
                            Display light debug lines
                        </label>
                        <p className="text-gray-300 text-xs w-60">
                            Toggle to visualize debug lines for lights in the
                            scene.
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        className="h-6 w-6 block bg-white border-2 border-white/20 cursor-pointer rounded transition-all duration-200"
                        id="hs-color-clear-color-input"
                        checked={sceneSettings.debug_lines.drawLights}
                        onChange={e =>
                            (sceneSettings.debug_lines.drawLights =
                                e.target.checked)
                        }
                    />
                </div>
            </div>
        </div>
    );
}
