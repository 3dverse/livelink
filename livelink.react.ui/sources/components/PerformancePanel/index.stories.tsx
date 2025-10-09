//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PerformancePanel } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Performance Panel",
    component: PerformancePanel,
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
} satisfies Meta<typeof PerformancePanel>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
};
