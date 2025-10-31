//------------------------------------------------------------------------------
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingOverlay } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Loading Overlay",
    component: LoadingOverlay,

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
