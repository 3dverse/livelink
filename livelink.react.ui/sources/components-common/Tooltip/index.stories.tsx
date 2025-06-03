//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

//------------------------------------------------------------------------------
import { Tooltip } from "./index";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Tooltip",
    component: Tooltip,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof Tooltip>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        label: "Hello tooltip",
        isDisabled: false,
        children: <div>Hover me</div>,
    },
    render: (args: any) => (
        <div className="livelink-react-ui-component">
            <Tooltip {...args} />
        </div>
    ),
};
