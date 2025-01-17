//------------------------------------------------------------------------------
export const ActionBar = ({ disconnect }: { disconnect: () => void }) => {
    return (
        <div role="menubar" className="absolute z-10 flex gap-1 top-4 right-4">
            <button className="button button-overlay" onClick={disconnect}>
                Disconnect
            </button>
        </div>
    );
};
