//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Canvas, useCameraEntity, useEntity, Viewport } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { SunPositionPicker } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Sun Position Picker",
    component: SunPositionPicker,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
    argTypes: {
        hasShadowToggle: {
            type: "boolean",
        },
    },
} satisfies Meta<typeof SunPositionPicker>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
const SUN_ENTITY_ID = "23e6b1cc-5e04-42c4-b179-12447556a170" as const;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    decorators: [
        (Story: React.ComponentType<{ sun: Entity; hasShadowToggle?: boolean }>, { args }) => {
            const { cameraEntity } = useCameraEntity({
                settings: { atmosphere: true, gradient: false },
            });
            const { isPending, entity: theSun } = useEntity({ euid: SUN_ENTITY_ID });

            if (!isPending && !theSun) {
                console.error("There's no sun entity in the scene");
                return <div>No sun entity found</div>;
            }

            return (
                <Canvas style={{ width: "100vw", height: "100vh" }}>
                    <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
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
                            <SunPositionPicker {...args} sun={theSun!} />
                        </div>
                    </Viewport>
                </Canvas>
            );
        },
    ],
};
