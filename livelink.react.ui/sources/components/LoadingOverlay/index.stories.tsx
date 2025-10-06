//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingOverlay } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Loading Overlay",
    component: LoadingOverlay,
    decorators: [
        Story => (
            <div style={{ position: "relative", height: "100vh" }}>
                <Story />
            </div>
        ),
    ],
    parameters: {
        layout: "fullscreen",
    },
} satisfies Meta<typeof LoadingOverlay>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
};
