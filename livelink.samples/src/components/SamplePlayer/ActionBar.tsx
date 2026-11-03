//------------------------------------------------------------------------------
export const ActionBar = ({ disconnect }: { disconnect: () => void }) => {
    return (
        <div role="menubar" className="absolute z-10 flex gap-1 bottom-1 md:bottom-4 right-1 md:right-4">
            <button className="button button-outline-overlay button-xs rounded-lg" onClick={disconnect}>
                Disconnect
            </button>
        </div>
    );
};
