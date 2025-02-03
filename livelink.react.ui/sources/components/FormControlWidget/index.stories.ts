//------------------------------------------------------------------------------
import type { Meta, StoryObj } from "@storybook/react";
import { FormControlWidget } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Form Control Widget",
    component: FormControlWidget,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof FormControlWidget>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        value: [1, 1, 1, 1],
        defaultValue: 1,
        type: "vec4",
        onChange: () => {},
    },
};
