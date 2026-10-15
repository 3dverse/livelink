//------------------------------------------------------------------------------
import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FaCopy, FaPen, FaTrash } from "react-icons/fa6";

//------------------------------------------------------------------------------
import { ContextMenu, ContextMenuItem } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Context Menu",
    component: ContextMenu,
    parameters: {
        layout: "fullscreen",
    },
} satisfies Meta<typeof ContextMenu>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
/**
 * Right-click anywhere to open the menu.
 */
export const _Component: Story = {
    args: { open: false, position: { x: 0, y: 0 }, onOpenChange: () => {} },
    render: () => <ContextMenuDemo />,
};

//------------------------------------------------------------------------------
function ContextMenuDemo(): React.JSX.Element {
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [lastAction, setLastAction] = useState("Right-click anywhere");

    return (
        <div
            className="livelink-react-ui-component"
            style={{ display: "grid", placeItems: "center", height: "100vh" }}
            onContextMenu={event => {
                event.preventDefault();
                setPosition({ x: event.clientX, y: event.clientY });
            }}
        >
            {lastAction}
            <ContextMenu
                open={position !== null}
                position={position ?? { x: 0, y: 0 }}
                onOpenChange={open => !open && setPosition(null)}
            >
                <ContextMenuItem icon={<FaCopy />} detail="Ctrl+C" onClick={() => setLastAction("Copied")}>
                    Copy
                </ContextMenuItem>
                <ContextMenuItem icon={<FaPen />} onClick={() => setLastAction("Renamed")}>
                    Rename
                </ContextMenuItem>
                <ContextMenuItem icon={<FaTrash />} disabled onClick={() => setLastAction("Deleted")}>
                    Delete
                </ContextMenuItem>
            </ContextMenu>
        </div>
    );
}
