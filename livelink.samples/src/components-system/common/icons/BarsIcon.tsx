//------------------------------------------------------------------------------
export const BarsIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 448 512"
        className={`w-5 h-5 ${className ?? ""}`}
        style={{
            fill: "currentcolor",
        }}
    >
        <path d="M0 64H448V96H0V64zM0 224H448v32H0V224zM448 384v32H0V384H448z" />
    </svg>
);
