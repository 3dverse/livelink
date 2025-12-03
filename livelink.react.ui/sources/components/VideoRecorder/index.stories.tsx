//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CameraControllerPresets } from "@3dverse/livelink";
import { CameraController, Canvas, useCameraEntity, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { ViewerPanel } from "../../components-common/ViewerPanel";
import { VideoRecorder } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Video Recorder",
    component: VideoRecorder,
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof VideoRecorder>;

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

        return (
            <Canvas style={{ width: "100vw", height: "100vh" }}>
                <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                    <CameraController preset={CameraControllerPresets.pointer_locked_orbital} />
                    <ViewerPanel
                        style={{
                            position: "absolute",
                            bottom: "5%",
                            left: "50%",
                            transform: "translate(-50%, 0)",
                            width: "12rem",
                            borderRadius: "0.25rem",
                        }}
                    >
                        <VideoRecorder {...args} />
                    </ViewerPanel>
                </Viewport>
            </Canvas>
        );
    },
};
