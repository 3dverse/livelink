//------------------------------------------------------------------------------
import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Client } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";

//------------------------------------------------------------------------------
export const ClientsContext = createContext<{ clients: Array<Client> }>({ clients: [] });

//------------------------------------------------------------------------------
function ClientsProvider({ children }: PropsWithChildren) {
    const { instance } = useContext(LivelinkContext);

    const [clients, setClients] = useState<Array<Client>>([]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const onClientsChanged = () => setClients(instance.session.other_clients);

        instance.session.addEventListener("client-joined", onClientsChanged);
        instance.session.addEventListener("client-left", onClientsChanged);

        onClientsChanged();

        return () => {
            instance.session.removeEventListener("client-joined", onClientsChanged);
            instance.session.removeEventListener("client-left", onClientsChanged);
            setClients([]);
        };
    }, [instance]);

    return <ClientsContext.Provider value={{ clients }}>{children}</ClientsContext.Provider>;
}

//------------------------------------------------------------------------------
export { ClientsProvider as Clients };
