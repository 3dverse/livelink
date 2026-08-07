//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
/**
 * A native `<select>` here would work everywhere, but its dropdown's direction is chosen by the
 * browser, not by CSS: desktop flips it above a control bar this close to the bottom of the
 * viewport, while Android Chrome does not, so the list opens downward and runs off-screen. This
 * always opens upward instead, which the control bar's position makes correct on every platform.
 */
export function SpeedSelect({
    options,
    value,
    onChange,
    label,
}: {
    options: { value: number; label: string }[];
    value: number;
    onChange: (value: number) => void;
    label: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function onPointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        window.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen]);

    const current = options.find(option => option.value === value);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                className="px-2 py-1 rounded-sm bg-[#333] text-white text-xs cursor-pointer"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(prev => !prev)}
            >
                {current?.label ?? value}
            </button>

            {isOpen && (
                <ul
                    role="listbox"
                    aria-label={label}
                    className="absolute bottom-full mb-1 left-0 min-w-full rounded-sm bg-[#333] text-white text-xs overflow-hidden"
                >
                    {options.map(option => (
                        <li
                            key={option.value}
                            role="option"
                            aria-selected={option.value === value}
                            className={`px-2 py-1 cursor-pointer whitespace-nowrap hover:bg-[#555] ${
                                option.value === value ? "bg-[#555]" : ""
                            }`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
