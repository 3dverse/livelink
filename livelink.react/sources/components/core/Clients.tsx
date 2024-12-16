//------------------------------------------------------------------------------
import React, { useEffect } from "react";

//------------------------------------------------------------------------------
import { Client } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "./Livelink";

//------------------------------------------------------------------------------
export const ClientsContext = React.createContext<{
    clients: Array<Client>;
}>({ clients: [] });

//------------------------------------------------------------------------------
function ClientsProvider({ children }: React.PropsWithChildren) {
    const { instance } = React.useContext(LivelinkContext);

    const [clients, setClients] = React.useState<Array<Client>>([]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const addClient = async (client: Client) => {
            const camera_rtid = client.camera_rtids[0];
            const camera = await instance.scene.getEntity({ entity_rtid: camera_rtid });
            if (!camera) {
                console.error("Camera not found for client", client);
                return;
            }
        };

        const onClientJoined = async (event: Event) => {
            const client = (event as CustomEvent).detail as Client;
            await addClient(client);
            setClients(instance.session.other_clients);
        };

        const onClientLeft = () => {
            setClients(instance.session.other_clients);
        };

        instance.session.addEventListener("client-joined", onClientJoined);
        instance.session.addEventListener("client-left", onClientLeft);

        for (const client of instance.session.other_clients) {
            addClient(client);
        }

        setClients(clients);

        return () => {
            instance.session.removeEventListener("client-joined", onClientJoined);
            instance.session.removeEventListener("client-left", onClientLeft);
            setClients([]);
        };
    }, [instance]);

    return <ClientsContext.Provider value={{ clients }}>{children}</ClientsContext.Provider>;
}

//------------------------------------------------------------------------------
export { ClientsProvider as Clients };
