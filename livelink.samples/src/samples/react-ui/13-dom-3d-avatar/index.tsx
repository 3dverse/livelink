//------------------------------------------------------------------------------
import { useCallback, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Client, Entity, Quat, UUID, Vec3 } from "@3dverse/livelink";
import {
    CameraController,
    CameraControllerContext,
    Canvas,
    DOM3DOverlay,
    Livelink,
    LivelinkContext,
    useCameraEntity,
    useClients,
    Viewport,
} from "@3dverse/livelink-react";
import { DOM3DAvatar, LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, SamplePlayer } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "0bb2690b-7962-4c66-baa9-35f83e66e866";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    const [sessionId, setSessionId] = useState<UUID | null>(null);

    return (
        <div className="relative flex w-full h-full">
            <SessionCreator setSessionId={setSessionId} />
            <SessionJoiner sessionId={sessionId} />
        </div>
    );
}

//------------------------------------------------------------------------------
function SessionCreator({
    setSessionId,
}: {
    setSessionId: (sessionId: UUID | null) => void;
}) {
    return (
        <SamplePlayer autoConnect={true} title="Create Session">
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
                autoJoinExisting={false}
            >
                <SessionSniffer setSessionId={setSessionId} />
                <AppLayout />
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function SessionJoiner({ sessionId }: { sessionId: UUID | null }) {
    if (!sessionId) {
        return (
            <div className="w-full h-full flex-col content-center justify-center">
                <h1 className="text-center text-xs text-secondary">
                    Waiting for the main session to join
                </h1>
            </div>
        );
    }

    return (
        <SamplePlayer autoConnect={true} title="Join Session">
            <Livelink
                sessionId={sessionId}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <AppLayout />
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController>
                    <Avatars />
                </CameraController>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function SessionSniffer({
    setSessionId,
}: {
    setSessionId: (sessionId: UUID | null) => void;
}) {
    const { instance } = useContext(LivelinkContext);
    useEffect(() => {
        setSessionId(instance?.session.session_id ?? null);
        return () => setSessionId(null);
    });
    return null;
}

//------------------------------------------------------------------------------
function Avatars() {
    const { instance } = useContext(LivelinkContext);
    const { cameraController } = useContext(CameraControllerContext);
    const { clients } = useClients();
    const currentClient = instance?.session.current_client ?? null;

    // Moves the local camera to the clicked client's camera pov, mirroring the
    // "Camera Travel" sample's `moveCamera`: land at their position, looking
    // toward a point ahead of them along their own forward direction.
    const travelToClient = useCallback(
        (entity: Entity) => {
            if (!cameraController) {
                return;
            }

            const position = entity.global_transform.position as Vec3;
            const orientation = entity.global_transform.orientation as Quat;
            const forward = rotateVecByQuat([0, 0, -1], orientation);
            const target = addVec3(
                position,
                scaleVec3(forward, cameraController.distance),
            );

            cameraController.setLookAt(...position, ...target, true);
        },
        [cameraController],
    );

    if (!instance) {
        return null;
    }

    // Connection order (current client first) drives the A/B/... letter assigned
    // to each avatar, so it stays consistent between the 3D overlay and the list.
    const allClients = currentClient ? [currentClient, ...clients] : clients;
    const letterByClientId = new Map(
        allClients.map((client, index) => [client.id, avatarLetter(index)]),
    );

    return (
        <>
            <DOM3DOverlay>
                {clients.map(client => (
                    <Avatar3D
                        key={client.id}
                        client={client}
                        letter={letterByClientId.get(client.id)!}
                        showViewport
                        onTravel={travelToClient}
                    />
                ))}
            </DOM3DOverlay>
            <AvatarList
                currentClient={currentClient}
                clients={clients}
                letterByClientId={letterByClientId}
                onTravel={travelToClient}
            />
        </>
    );
}

//------------------------------------------------------------------------------
const AvatarList = ({
    currentClient,
    clients,
    letterByClientId,
    onTravel,
}: {
    currentClient: Client | null;
    clients: Array<Client>;
    letterByClientId: Map<UUID, string>;
    onTravel: (entity: Entity) => void;
}) => {
    const allClients = currentClient ? [currentClient, ...clients] : clients;

    // Travels straight to the clicked client, resolving their camera entity on demand rather than
    // keeping it around: unlike `Avatar3D`, the list doesn't need to react to it every frame.
    const handleClick = (client: Client): void => {
        client.getCameraEntities().then(cameraEntities => {
            const entity = cameraEntities[0];
            if (entity) {
                onTravel(entity);
            }
        });
    };

    return (
        <div className="absolute left-4 top-4">
            <div className="avatar-group flex items-start gap-2 rtl:space-x-reverse">
                {allClients.map(client => {
                    const isCurrentClient = client === currentClient;
                    const color = colorFromClientId(client.id);
                    const letter = letterByClientId.get(client.id)!;

                    return (
                        <div
                            key={client.id}
                            className={`relative transition-all duration-350 ${!isCurrentClient ? "starting:opacity-0 starting:-translate-x-3" : ""}`}
                            style={
                                {
                                    "--avatar-color": color,
                                } as React.CSSProperties
                            }
                        >
                            <button
                                onClick={() => handleClick(client)}
                                disabled={isCurrentClient}
                                data-is-current-client={isCurrentClient}
                                className={`
                                    outline-0 outline-(--avatar-color) outline-offset-1 rounded-full
                                    data-[is-current-client=false]:hover:outline-2 data-[is-current-client=false]:cursor-pointer
                                    transition-all duration-100
                                `}
                            >
                                <Avatar
                                    client={client}
                                    color={color}
                                    letter={letter}
                                />
                            </button>
                            {isCurrentClient && (
                                <span
                                    className={`
                                        absolute left-1/2 -bottom-1 -translate-x-1/2 block px-1.5 whitespace-nowrap text-[10px] text-white/90 rounded-full border 
                                        bg-[color-mix(in_srgb,var(--avatar-color)_70%,black)] border-(--avatar-color)
                                    `}
                                >
                                    me
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

//------------------------------------------------------------------------------
/** Deterministically hashes a string into a 32-bit integer. */
function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

/**
 * The avatar color is keyed on `client.id` rather than `client.user_id`/`username`:
 * this sample connects both viewports with the same shared public demo token, so
 * every client is logged in as the same backend account and gets the same
 * `user_id` and `username`. `id` (the per-connection identifier) is the only
 * field that's actually distinct between clients here, so it's what drives a
 * distinct color per avatar.
 */
function colorFromClientId(clientId: UUID): string {
    const hue = Math.abs(hashString(clientId)) % 360;
    return `hsl(${hue}, 65%, 45%)`;
}

/**
 * Letter shown on an avatar, based on connection order rather than the shared
 * fake username: the first client to join is always "A", the second "B", etc.
 */
function avatarLetter(index: number): string {
    return String.fromCharCode(65 + index);
}

//------------------------------------------------------------------------------
const Avatar = ({
    client,
    color,
    letter,
}: {
    client: Client;
    color?: string;
    letter: string;
}) => {
    return (
        <div
            title={letter}
            className="flex items-center justify-center rounded-full text-white text-xs font-medium select-none"
            style={{
                width: 40,
                height: 40,
                backgroundColor: color ?? colorFromClientId(client.id),
            }}
        >
            {letter}
        </div>
    );
};

//------------------------------------------------------------------------------
const Avatar3D = ({
    client,
    letter,
    showViewport = false,
    onTravel,
}: {
    client: Client;
    letter: string;
    showViewport?: boolean;
    onTravel?: (entity: Entity) => void;
}) => {
    const [clientCameraEntity, setClientCameraEntity] = useState<Entity | null>(
        null,
    );

    useEffect(() => {
        client
            .getCameraEntities()
            .then(cameraEntities => setClientCameraEntity(cameraEntities[0]));
    }, [client]);

    return (
        <DOM3DAvatar
            client={client}
            entity={clientCameraEntity}
            scaleFactor={0.0025}
            color={colorFromClientId(client.id)}
            label={letter}
            showViewportRectangle={showViewport}
            showOffscreenIndicator
            onTravel={onTravel}
        />
    );
};

//------------------------------------------------------------------------------
function addVec3(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec3(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s];
}

/** Rotate `v` by unit quaternion `q` (local → world). */
function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
    const ix = q[0];
    const iy = q[1];
    const iz = q[2];
    const iw = q[3];

    const tx = 2 * (iy * v[2] - iz * v[1]);
    const ty = 2 * (iz * v[0] - ix * v[2]);
    const tz = 2 * (ix * v[1] - iy * v[0]);

    return [
        v[0] + iw * tx + iy * tz - iz * ty,
        v[1] + iw * ty + iz * tx - ix * tz,
        v[2] + iw * tz + ix * ty - iy * tx,
    ];
}
