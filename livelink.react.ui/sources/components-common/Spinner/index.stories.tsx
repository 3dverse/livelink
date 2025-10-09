//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { Spinner } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Spinner",
    component: Spinner,
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof Spinner>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    render: args => (
        <div className="livelink-react-ui-component">
            <Spinner {...args} />
        </div>
    ),
};
