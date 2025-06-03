//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CameraController, Canvas, Viewport, useCameraEntity } from "@3dverse/livelink-react";
import { Entity } from "@3dverse/livelink";
import { ViewCube } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/View Cube",
    component: ViewCube,
    parameters: {
        layout: "fullscreen",
    },
    tags: ["autodocs"],
    args: {},
} satisfies Meta<typeof ViewCube>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    decorators: [
        (Story: React.ComponentType<{ sun: Entity; hasShadowToggle?: boolean }>, { args }) => {
            const { cameraEntity } = useCameraEntity({
                settings: { atmosphere: true, gradient: false },
            });

            const faceStyles = {
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            };

            return (
                <Canvas style={{ position: "relative", width: "100vw", height: "100vh" }}>
                    <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                        <CameraController />
                        <div
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                            }}
                        >
                            {/* TODO: replace by component Story */}
                            <ViewCube {...args}>
                                <div style={{ backgroundColor: "red", ...faceStyles }}>1</div>
                                <div style={{ backgroundColor: "green", ...faceStyles }}>2</div>
                                <div style={{ backgroundColor: "blue", ...faceStyles }}>3</div>
                                <div style={{ backgroundColor: "yellow", ...faceStyles }}>4</div>
                                <div style={{ backgroundColor: "purple", ...faceStyles }}>5</div>
                                <div style={{ backgroundColor: "orange", ...faceStyles }}>6</div>
                            </ViewCube>
                        </div>
                    </Viewport>
                </Canvas>
            );
        },
    ],
};
