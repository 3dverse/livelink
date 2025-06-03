//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CameraController, Canvas, useCameraEntity, Viewport } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { LightControl } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Light Control",
    component: LightControl,
    parameters: {
        layout: "fullscreen",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof LightControl>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    decorators: [
        (Story: React.ComponentType<{ lights: Entity[] }>, { args }) => {
            const { cameraEntity } = useCameraEntity({
                settings: { atmosphere: true, gradient: false },
            });

            return (
                <Canvas style={{ width: "100vw", height: "100vh" }}>
                    <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                        <CameraController />
                        <div
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                backgroundColor: "black",
                            }}
                        >
                            {/* TODO: replace by component Story */}
                            <LightControl {...args} />
                        </div>
                    </Viewport>
                </Canvas>
            );
        },
    ],
};
