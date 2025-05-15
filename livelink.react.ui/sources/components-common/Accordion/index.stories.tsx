//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

//------------------------------------------------------------------------------
import { AccordionItem, AccordionButton, AccordionPanel } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Accordion",
    component: AccordionItem,
    subcomponents: {
        AccordionButton: AccordionButton as React.ComponentType<any>,
        AccordionPanel: AccordionPanel as React.ComponentType<any>,
    },
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof AccordionItem>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        isExpandable: true,
        children: <div>Accordion</div>,
    },
    render: ({ isExpandable, ...args }) => (
        <div className="livelink-react-ui-component">
            <AccordionItem {...args} isExpandable={isExpandable}>
                <AccordionButton isExpandable={isExpandable}>Button</AccordionButton>
                <AccordionPanel>Panel</AccordionPanel>
            </AccordionItem>
        </div>
    ),
};
