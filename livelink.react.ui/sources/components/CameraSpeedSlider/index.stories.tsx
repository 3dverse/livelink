//------------------------------------------------------------------------------
import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CameraControllerPresets } from "@3dverse/livelink";
import { CameraController, Canvas, DefaultCameraController, useCameraEntity, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { ViewerPanel } from "../../components-common/ViewerPanel";
import { CameraSpeedSlider } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Camera Speed Slider",
    component: CameraSpeedSlider,
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof CameraSpeedSlider>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const _Component: Story = {
    render: (args: any) => {
        const { cameraEntity } = useCameraEntity({
            settings: {
                ssr: true,
                volumetricLighting: true,
                density: 0.5,
            },
        });
        const [cameraController, setCameraController] = useState<DefaultCameraController | null>();

        const [isOpen, setIsOpen] = useState(true);

        const handleChange = (speed: number) => {
            console.log("speed", speed);
        };

        return (
            <Canvas style={{ width: "100vw", height: "100vh" }}>
                <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                    <CameraController ref={ref => setCameraController(ref)} preset={CameraControllerPresets.fly} />
                    {cameraController && (
                        <>
                            <button
                                style={{
                                    position: "absolute",
                                    bottom: "2%",
                                    right: "2%",
                                }}
                                onClick={() => setIsOpen(!isOpen)}
                            >
                                Toggle panels
                            </button>
                            {isOpen && (
                                <ViewerPanel
                                    style={{
                                        position: "absolute",
                                        bottom: "5%",
                                        left: "0",
                                        height: "90%",
                                        borderStartStartRadius: "0",
                                        borderEndStartRadius: "0",
                                    }}
                                >
                                    <CameraSpeedSlider
                                        cameraController={cameraController}
                                        orientation="vertical"
                                        label="Speed"
                                        onChange={handleChange}
                                        {...args}
                                    />
                                </ViewerPanel>
                            )}
                            {isOpen && (
                                <ViewerPanel
                                    style={{
                                        position: "absolute",
                                        bottom: "5%",
                                        left: "50%",
                                        transform: "translate(-50%, 0)",
                                        width: "25%",
                                    }}
                                >
                                    <CameraSpeedSlider
                                        cameraController={cameraController}
                                        orientation="horizontal"
                                        label="Speed"
                                        onChange={handleChange}
                                        {...args}
                                    />
                                </ViewerPanel>
                            )}
                        </>
                    )}
                </Viewport>
            </Canvas>
        );
    },
};
