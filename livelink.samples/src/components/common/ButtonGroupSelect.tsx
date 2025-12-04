//------------------------------------------------------------------------------
export function ButtonGroupSelect<T>({
    value,
    items,
    onChange,
    buttonClassName = "px-2 py-1 border-2 border-[#333] rounded-lg min-w-12 text-center cursor-pointer",
    selectedButtonClassName = "bg-white text-[#333]",
    unselectedButtonClassName = "bg-[#333] text-white",
}: {
    value: T;
    items: { value: T; label: string }[];
    onChange?: (value: T) => void;
    buttonClassName?: string;
    selectedButtonClassName?: string;
    unselectedButtonClassName?: string;
}) {
    return (
        <>
            {items.map(({ value: v, label }, index) => (
                <button
                    key={index}
                    onClick={() => {
                        onChange?.(v);
                    }}
                    className={`${buttonClassName} ${value === v ? selectedButtonClassName : unselectedButtonClassName}`}
                >
                    {label}
                </button>
            ))}
        </>
    );
}
