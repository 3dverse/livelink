//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Canvas, useCameraEntity, Viewport } from "@3dverse/livelink-react";
import { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { RenderGraphSettings } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Render Graph Settings",
    component: RenderGraphSettings,
    parameters: {
        layout: "fullscreen",
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
                <Canvas style={{ width: "100%", height: "100vh" }}>
                    <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                        {/* TODO: replace by component Story */}
                        <div
                            style={{
                                display: "grid",
                                placeItems: "center",
                                height: "100%",
                            }}
                        >
                            <div
                                style={{
                                    width: "400px",
                                    backgroundColor: "var(--3dverse-color-bg-ground)",
                                    zIndex: 1000,
                                    maxHeight: "100vh",
                                    overflowY: "auto",
                                }}
                            >
                                <RenderGraphSettings {...args} cameraEntity={cameraEntity} />
                            </div>
                        </div>
                    </Viewport>
                </Canvas>
            );
        },
    ],
};
