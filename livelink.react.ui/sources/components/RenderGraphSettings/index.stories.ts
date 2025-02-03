//------------------------------------------------------------------------------
import type { Meta, StoryObj } from "@storybook/react";
import { RenderGraphSettings } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Render Graph Settings",
    component: RenderGraphSettings,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof RenderGraphSettings>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        userToken: "",
        cameraEntity: null,
    },
};
