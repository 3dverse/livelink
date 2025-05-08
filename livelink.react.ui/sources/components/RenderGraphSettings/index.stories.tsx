//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RenderGraphSettings } from ".";
import { Canvas, useCameraEntity, Viewport } from "@3dverse/livelink-react";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Render Graph Settings",
    component: RenderGraphSettings,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
    args: {
        userToken: import.meta.env.STORYBOOK_3DVERSE_PUBLIC_TOKEN,
        cameraEntity: null,
    },
    argTypes: {
        cameraEntity: { table: { disable: true } },
    },
} satisfies Meta<typeof RenderGraphSettings>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    decorators: [
        (Story: React.ComponentType<{ cameraEntity: Entity | null }>, { args }) => {
            const { cameraEntity } = useCameraEntity();
            return (
                <Canvas style={{ width: "100vw", height: "100vh" }}>
                    <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                        {/* TODO: replace by component Story */}
                        <RenderGraphSettings {...args} cameraEntity={cameraEntity} />
                    </Viewport>
                </Canvas>
            );
        },
    ],
};
