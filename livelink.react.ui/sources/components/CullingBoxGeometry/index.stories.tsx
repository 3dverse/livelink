//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CameraController, Canvas, useCameraEntity, Viewport } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { CullingBoxGeometry } from ".";
import { CullingBoxGeometryButton } from "./CullingBoxGeometryButton";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Culling Box Geometry",
    component: CullingBoxGeometry,
    parameters: {
        layout: "fullscreen",
    },
    args: {
        initialSize: [5, 5, 5],
        initialPosition: [-2.5, 2.5, 0],
        isActiveByDefault: true,
    },
} satisfies Meta<typeof CullingBoxGeometry>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    render: (args: any) => {
        const { cameraEntity } = useCameraEntity({
            position: [20, 20, 20],
            eulerOrientation: [-45, 45, 0],
        });

        return (
            <Canvas style={{ width: "100vw", height: "100vh" }}>
                <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                    <CameraController />
                    <CullingBoxGeometry {...args} />
                </Viewport>
            </Canvas>
        );
    },
};

//------------------------------------------------------------------------------
export const _CullingBoxGeometryButton: Story = {
    render: (args: any) => {
        const { cameraEntity } = useCameraEntity({
            position: [20, 20, 20],
            eulerOrientation: [-45, 45, 0],
        });

        return (
            <Canvas style={{ width: "100vw", height: "100vh" }}>
                <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                    <CameraController />
                    <CullingBoxGeometry {...args}>
                        <div style={{ position: "absolute", bottom: "4rem", left: "50%", translate: "-50% 0" }}>
                            <CullingBoxGeometryButton>
                                {({ toggle, isActive }) => (
                                    <button style={{ padding: "0.5rem 1rem", cursor: "pointer" }} onClick={toggle}>
                                        {isActive ? "Hide" : "Show"} Box Geometry
                                    </button>
                                )}
                            </CullingBoxGeometryButton>
                        </div>
                    </CullingBoxGeometry>
                </Viewport>
            </Canvas>
        );
    },
};
