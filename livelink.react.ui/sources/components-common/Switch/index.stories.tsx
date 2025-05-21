//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

//------------------------------------------------------------------------------
import { Switch } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Switch",
    component: Switch,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof Switch>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        isChecked: false,
        onChange: () => {},
    },
    render: args => (
        <div className="livelink-react-ui-component">
            <Switch {...args} />
        </div>
    ),
};
