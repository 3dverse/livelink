//------------------------------------------------------------------------------
import type { Meta, StoryObj } from "@storybook/react";
import { SunPositionPicker } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Sun Position Picker",
    component: SunPositionPicker,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof SunPositionPicker>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
};
