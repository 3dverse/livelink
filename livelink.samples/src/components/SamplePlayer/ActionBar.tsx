//------------------------------------------------------------------------------
export const ActionBar = ({ disconnect }: { disconnect: () => void }) => {
    return (
        <div role="menubar" className="absolute z-10 flex gap-1 top-1 md:top-2 right-1 md:right-2">
            <button className="button button-outline-overlay button-xs rounded-lg" onClick={disconnect}>
                Disconnect
            </button>
        </div>
    );
};
