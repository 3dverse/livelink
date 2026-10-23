//------------------------------------------------------------------------------
import React, { createContext, PropsWithChildren, useContext, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

//------------------------------------------------------------------------------
import styles from "./index.module.css";

//------------------------------------------------------------------------------
/** Margin kept between the menu and the edges of the window, in pixels. */
const WINDOW_MARGIN = 8;

const ContextMenuContext = createContext<{ close: () => void }>({ close: () => {} });

//------------------------------------------------------------------------------
export type ContextMenuProps = PropsWithChildren<{
    /** Whether the menu is displayed. */
    open: boolean;

    /** Where the menu opens, usually where the pointer was right-clicked, in viewport coordinates. */
    position: { x: number; y: number };

    /** Called when the menu asks to be closed: on Escape, on a press outside of it, or once an item is picked. */
    onOpenChange: (open: boolean) => void;

    className?: string;
}>;

/**
 * A contextual menu, opened at a position of the page, typically where the pointer was right-clicked. It opens
 * towards the bottom right of that position, or the other way where it would leave the window, and focuses its
 * first item so that it can be picked with the keyboard.
 *
 * It is rendered at the root of the page, so that it can be opened from anywhere, including from a 3D overlay
 * whose transforms would otherwise offset it. It closes on Escape, on a press outside of it, when the page
 * scrolls or resizes, and once an item is picked.
 *
 * @example
 * ```tsx
 * const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
 *
 * <div onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }); }} />
 * <ContextMenu open={menu !== null} position={menu ?? { x: 0, y: 0 }} onOpenChange={open => !open && setMenu(null)}>
 *     <ContextMenuItem icon={<FaCopy />} onClick={copy}>Copy</ContextMenuItem>
 * </ContextMenu>
 * ```
 */
export function ContextMenu({
    open,
    position,
    onOpenChange,
    className,
    children,
}: ContextMenuProps): React.JSX.Element | null {
    const menuRef = useRef<HTMLDivElement>(null);
    const onOpenChangeRef = useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (): void => onOpenChangeRef.current(false);
        const onPointerDown = (event: PointerEvent): void => {
            if (!menuRef.current?.contains(event.target as Node)) {
                close();
            }
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.stopPropagation();
                close();
            }
        };

        window.addEventListener("pointerdown", onPointerDown, { capture: true });
        window.addEventListener("keydown", onKeyDown, { capture: true });
        window.addEventListener("resize", close);
        window.addEventListener("scroll", close, { capture: true });
        return (): void => {
            window.removeEventListener("pointerdown", onPointerDown, { capture: true });
            window.removeEventListener("keydown", onKeyDown, { capture: true });
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", close, { capture: true });
        };
    }, [open]);

    //--------------------------------------------------------------------------
    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!open || !menu) {
            return;
        }

        const { width, height } = menu.getBoundingClientRect();
        const x = position.x + width + WINDOW_MARGIN > window.innerWidth ? position.x - width : position.x;
        const y = position.y + height + WINDOW_MARGIN > window.innerHeight ? position.y - height : position.y;
        menu.style.left = `${Math.max(WINDOW_MARGIN, x)}px`;
        menu.style.top = `${Math.max(WINDOW_MARGIN, y)}px`;
        menu.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus({ preventScroll: true });
    }, [open, position.x, position.y]);

    //--------------------------------------------------------------------------
    if (!open) {
        return null;
    }

    return createPortal(
        <ContextMenuContext.Provider value={{ close: () => onOpenChangeRef.current(false) }}>
            <div
                ref={menuRef}
                role="menu"
                className={[styles.menu, "livelink-react-ui-component", className].filter(Boolean).join(" ")}
                style={{ left: position.x, top: position.y }}
                onContextMenu={event => event.preventDefault()}
                onKeyDown={event => moveFocus(event, menuRef.current)}
            >
                {children}
            </div>
        </ContextMenuContext.Provider>,
        document.body,
    );
}

//------------------------------------------------------------------------------
export type ContextMenuItemProps = PropsWithChildren<{
    /** Called when the item is picked, before the menu closes. */
    onClick: () => void;

    /** Displayed before the label. */
    icon?: React.ReactNode;

    /** Displayed at the end of the item, e.g. a value or a keyboard shortcut. */
    detail?: React.ReactNode;

    disabled?: boolean;
    className?: string;
}>;

/**
 * An item of a `ContextMenu`, closing it once picked.
 */
export function ContextMenuItem({
    onClick,
    icon,
    detail,
    disabled,
    className,
    children,
}: ContextMenuItemProps): React.JSX.Element {
    const { close } = useContext(ContextMenuContext);

    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className={[styles.item, className].filter(Boolean).join(" ")}
            onClick={() => {
                onClick();
                close();
            }}
        >
            {icon && (
                <span className={styles.icon} aria-hidden>
                    {icon}
                </span>
            )}
            {children}
            {detail && <span className={styles.detail}>{detail}</span>}
        </button>
    );
}

//------------------------------------------------------------------------------
/** Moves the focus between the items with the arrow keys, Home and End. */
function moveFocus(event: React.KeyboardEvent, menu: HTMLElement | null): void {
    if (!menu || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        return;
    }

    event.preventDefault();
    const items = Array.from(menu.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
        event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
}
