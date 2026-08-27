//------------------------------------------------------------------------------
// Multiplayer game: rooms hosted by agents (referees), controlled via shared tags.
// Click cubes to score; agent awards points and manages rounds.
// Lobby: multi-room browser UI; Agent: can run as Node.js headless service.
//------------------------------------------------------------------------------
import {
    useCallback,
    useContext,
    useEffect,
    useReducer,
    useRef,
    useState,
} from "react";

//------------------------------------------------------------------------------
import { Agent, Session } from "@3dverse/livelink-agent";
import type {
    AgentConfig,
    EntitiesDeletedEvent as AgentEntitiesDeletedEvent,
    Entity as AgentEntity,
    EntityUpdatedEvent as AgentEntityUpdatedEvent,
    Livelink as AgentLivelink,
    SessionInfo,
    UUID,
} from "@3dverse/livelink-agent";
import type {
    EntitiesDeletedEvent,
    Entity,
    EntityUpdatedEvent,
} from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    useCameraEntity,
    useClients,
    CameraController,
    LivelinkContext,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { startOrbitingAnimation } from "@/samples/advanced/x-agent-multiplayer-game/orbiting-animation";
import type { OrbitingAnimation } from "@/samples/advanced/x-agent-multiplayer-game/orbiting-animation";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const SCENE_ID = "916f6c80-d6e7-4610-82ba-cfd35f4d6dbc";

// Well-known roster entity: agents register themselves here.
const AGENT_ROSTER_ENTITY_ID = "d577efd3-cca8-41ca-a58e-27e944f7b5de";

// Shared scene assets (cube mesh and materials).
const MESH_REF = "0577814f-4677-420b-89e8-1e5a4dd56914";
const MATERIAL_REFS = [
    "5bd5d2c5-65d3-4cdb-adb1-c85ae1502840", // Light
    "afbcef75-7c52-4a90-b6e6-d19dcc04c3ad", // Green
    "9b848934-e592-41a9-895f-11ab01892b1d", // Wood
    "c9650d73-0f0b-4064-843f-ff0bb8d506e7", // Dark
    "438bca58-a9e8-41db-910e-4174ac93437f", // Dark Green
    "78b48c3a-9988-433a-9237-9ea5dc7a57e5", // Orange
    "6f39abc9-9147-498e-9530-b41a6f8c2e2a", // Purple
] as const;

// The name of the entity carrying the room's game state.
const GAME_ENTITY_NAME = "Game";

// Tag that marks cubes for picking.
const CUBE_TAG = "cube";

// Game state tag keys.
const SCORE_TAG_PREFIX = "score.";
const RESTART_TAG = "restart";

// Lobby refresh interval.
const LOBBY_POLL_SECONDS = 2;

// Agent leaves when alone (closes transient session).
const AGENT_LEAVE_WHEN_ALONE_SECONDS = 20;

// The most rooms the lobby will create at once.
const MAX_ROOMS = 4;

//==============================================================================
// Shared: pure functions to parse/read game state from tags.
//==============================================================================
function parseTags(values: Array<string> = []): Record<string, string> {
    const entries: Record<string, string> = {};
    for (const tag of values) {
        const separator = tag.indexOf("=");
        if (separator > 0) {
            entries[tag.slice(0, separator)] = tag.slice(separator + 1);
        }
    }
    return entries;
}

//------------------------------------------------------------------------------
type GameState = {
    host_client_id: UUID | null;
    round: number;
    is_over: boolean;
    cubes_left: number;
    started_at: number;
    ended_at: number;
    restart_requested: number;
    scores: Record<UUID, number>;
};

//------------------------------------------------------------------------------
function readGameState(values: Array<string> = []): GameState {
    const tags = parseTags(values);

    const scores: Record<UUID, number> = {};
    for (const [key, value] of Object.entries(tags)) {
        if (key.startsWith(SCORE_TAG_PREFIX)) {
            scores[key.slice(SCORE_TAG_PREFIX.length)] = Number(value);
        }
    }

    return {
        host_client_id: tags.host ?? null,
        round: Number(tags.round ?? 0),
        is_over: tags.state === "over",
        cubes_left: Number(tags.cubes ?? 0),
        started_at: Number(tags.started_at ?? 0),
        ended_at: Number(tags.ended_at ?? 0),
        restart_requested: Number(tags[RESTART_TAG] ?? 0),
        scores,
    };
}

//------------------------------------------------------------------------------
function formatDuration(milliseconds: number): string {
    const total_seconds = Math.max(0, milliseconds) / 1000;
    const minutes = Math.floor(total_seconds / 60);
    return `${minutes}:${(total_seconds % 60).toFixed(1).padStart(4, "0")}`;
}

//------------------------------------------------------------------------------
// Lobby: runs one idle agent and displays room cards.
export function App() {
    const agentRef = useRef<Agent | null>(null);

    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [rooms, setRooms] = useState<Array<SessionInfo>>([]);
    const [joinedRoomIds, setJoinedRoomIds] = useState<Set<UUID>>(new Set());
    const roomCount = rooms.length;
    const unjoinedRooms = rooms.filter(
        room => !joinedRoomIds.has(room.session_id),
    );
    const joinedRooms = rooms.filter(room =>
        joinedRoomIds.has(room.session_id),
    );

    // Start lobby agent (attaches to rooms when created).
    useEffect(() => {
        const agent = createGameAgent({
            config: {
                scene_id: SCENE_ID,
                token,
                is_transient: true,
                mode: "manual",
                leave_on_condition: {
                    after_seconds: AGENT_LEAVE_WHEN_ALONE_SECONDS,
                    // Agent registers in roster to distinguish from viewers.
                    agent_roster_id: AGENT_ROSTER_ENTITY_ID,
                },
            },
        });
        agentRef.current = agent;

        agent.start().catch((error: Error) => {
            console.error("Failed to start the lobby agent", error);
        });

        return () => {
            agentRef.current = null;
            void agent.stop();
        };
    }, []);

    // Poll the list of rooms.
    const refreshRooms = useCallback(async () => {
        try {
            setRooms(await Session.list({ scene_id: SCENE_ID, token }));
        } catch (error) {
            console.error("Failed to list rooms", error);
        }
    }, []);

    useEffect(() => {
        void refreshRooms();
        const timer = setInterval(
            () => void refreshRooms(),
            LOBBY_POLL_SECONDS * 1000,
        );
        return () => clearInterval(timer);
    }, [refreshRooms]);

    // Create room and join as player (agent hosts and starts round).
    const createRoom = async (): Promise<void> => {
        if (roomCount >= MAX_ROOMS) {
            return;
        }
        setIsCreatingRoom(true);
        try {
            const session = await Session.create({
                scene_id: SCENE_ID,
                token,
                is_transient: true,
            });
            // Become the host of the room we just created.
            await agentRef.current?.join({ session_id: session.session_id });
            setJoinedRoomIds(current =>
                new Set(current).add(session.session_id),
            );
            await refreshRooms();
        } catch (error) {
            console.error("Failed to create a room", error);
        } finally {
            setIsCreatingRoom(false);
        }
    };

    // Render room card (joined or unjoined).
    const renderCard = (room: SessionInfo) => {
        const { session_id } = room;
        const agent = agentRef.current;
        // Check if we (the agent) are hosting this room.
        const isHostedByMe =
            agent !== null && agent.getLivelink({ session_id }) !== null;
        return (
            <RoomCard
                key={session_id}
                room={room}
                isJoined={joinedRoomIds.has(session_id)}
                isHostedByMe={isHostedByMe}
                onToggleJoin={() =>
                    setJoinedRoomIds(current => {
                        const next = new Set(current);
                        if (next.has(session_id)) {
                            next.delete(session_id);
                        } else {
                            next.add(session_id);
                        }

                        return next;
                    })
                }
                onStopHosting={async () => {
                    await agentRef.current?.leave({ session_id });
                }}
            />
        );
    };

    return (
        <div className="flex flex-col w-full h-full">
            <header className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
                <h2 className="font-medium">
                    Lobby — {roomCount} / {MAX_ROOMS} rooms
                </h2>
                <button
                    className={`button button-primary disabled:opacity-50 disabled:cursor-not-allowed`}
                    onClick={isCreatingRoom ? undefined : createRoom}
                    disabled={roomCount >= MAX_ROOMS || isCreatingRoom}
                >
                    {isCreatingRoom
                        ? "    Creating..."
                        : roomCount >= MAX_ROOMS
                          ? "Room limit reached"
                          : "Create room"}
                </button>
            </header>

            <main className="grow min-h-0 p-3 flex flex-col gap-2 overflow-auto">
                {roomCount === 0 ? (
                    <div className="flex items-center justify-center h-full opacity-70">
                        <p>No rooms yet — create one to get started.</p>
                    </div>
                ) : (
                    <>
                        {unjoinedRooms.length > 0 && (
                            <div className="flex flex-col gap-1 shrink-0">
                                {unjoinedRooms.map(renderCard)}
                            </div>
                        )}
                        {joinedRooms.length > 0 && (
                            <div
                                className="grid gap-3 grow min-h-0"
                                style={{
                                    gridTemplateColumns: `repeat(${gridColumns(joinedRooms.length)}, minmax(0, 1fr))`,
                                    gridAutoRows: "1fr",
                                }}
                            >
                                {joinedRooms.map(renderCard)}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

//------------------------------------------------------------------------------
// Calculate grid columns for square-ish layout.
function gridColumns(count: number): number {
    return Math.max(1, Math.ceil(Math.sqrt(count)));
}

//------------------------------------------------------------------------------
// Room card: controls + game (if joined).
function RoomCard({
    room,
    isJoined,
    isHostedByMe,
    onToggleJoin,
    onStopHosting,
}: {
    room: SessionInfo;
    isJoined: boolean;
    isHostedByMe: boolean;
    onToggleJoin: () => void;
    onStopHosting: () => void;
}) {
    const clientCount = room.clients?.length ?? 0;

    return (
        <div className="flex flex-col min-h-0 h-full rounded-xl overflow-hidden bg-foreground">
            <div className="flex items-center justify-between gap-2 px-3 py-2 shrink-0">
                <div className="flex flex-col tabular-nums text-xs">
                    <span className="font-mono">
                        {room.session_id.slice(0, 8)}
                    </span>
                    <span className="opacity-70">
                        {clientCount} client{clientCount === 1 ? "" : "s"}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        className="button button-primary"
                        onClick={onToggleJoin}
                    >
                        {isJoined ? "Leave Game" : "Join Game"}
                    </button>
                    {isHostedByMe && (
                        <button className="button" onClick={onStopHosting}>
                            Stop Game
                        </button>
                    )}
                </div>
            </div>

            {isJoined && (
                <div className="relative grow min-h-0 bg-[black]/30">
                    <Livelink sessionId={room.session_id} token={token}>
                        <GameLayout />
                    </Livelink>
                </div>
            )}
        </div>
    );
}

//------------------------------------------------------------------------------
// Game: viewport, scoreboard, round HUD, and end-of-round panel.
function GameLayout() {
    const { instance } = useContext(LivelinkContext);
    const { cameraEntity } = useCameraEntity();

    const { game, hostLeft, requestRestart } = useGame();
    const players = usePlayers({ game });
    const elapsed = useRoundClock(game);

    const [hoveredCube, setHoveredCube] = useState<Entity | null>(null);

    // Highlight the cube under the cursor, so it reads as clickable.
    useEffect(() => {
        void instance?.scene.highlightEntities({
            entities: hoveredCube ? [hoveredCube] : [],
        });
    }, [instance, hoveredCube]);

    // Identify cubes by tag (only clickable entity type).
    const isCube = useCallback(
        (entity: Entity | null): entity is Entity =>
            entity?.tags?.value.includes(CUBE_TAG) ?? false,
        [],
    );

    const onHover = useCallback(
        (data: { entity: Entity } | null) => {
            const entity = data?.entity ?? null;
            setHoveredCube(isCube(entity) ? entity : null);
        },
        [isCube],
    );

    // Delete cube; agent awards points.
    const onPick = useCallback(
        (data: { entity: Entity } | null) => {
            const entity = data?.entity ?? null;
            if (!instance || !isCube(entity)) {
                return;
            }
            setHoveredCube(null);
            void instance.scene.deleteEntities({ entities: [entity] });
        },
        [instance, isCube],
    );

    return (
        <>
            <Canvas className="w-full h-full">
                <Viewport
                    cameraEntity={cameraEntity}
                    className={`w-full h-full ${hoveredCube ? "cursor-pointer" : ""}`}
                    setHoveredEntity={onHover}
                    setPickedEntity={onPick}
                >
                    <CameraController />
                </Viewport>
            </Canvas>

            {game && !game.is_over && (
                <>
                    <Scoreboard
                        players={players}
                        className="absolute top-3 left-3"
                    />
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1 text-xs tabular-nums select-none">
                        <span className="px-2 py-1 rounded-md bg-black/60">
                            {game.cubes_left} cubes left
                        </span>
                        <span className="px-2 py-1 rounded-md bg-black/60">
                            {formatDuration(elapsed)}
                        </span>
                    </div>
                </>
            )}

            {game?.is_over && (
                <GameOverPanel
                    game={game}
                    players={players}
                    onRestart={requestRestart}
                />
            )}

            {!game && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                    {hostLeft ? (
                        <NeonBanner>Host left</NeonBanner>
                    ) : (
                        <span className="opacity-70">
                            Waiting for the host…
                        </span>
                    )}
                </div>
            )}
        </>
    );
}

//------------------------------------------------------------------------------
function Scoreboard({
    players,
    className = "",
}: {
    players: Array<Player>;
    className?: string;
}) {
    const best = players.reduce(
        (best, player) => Math.max(best, player.score),
        0,
    );

    return (
        <div
            className={`flex flex-col gap-1 text-xs tabular-nums select-none ${className}`}
        >
            {players.map(player => (
                <div
                    key={player.client_id}
                    className={`flex items-center justify-between gap-6 px-2 py-1 rounded-md ${
                        best > 0 && player.score === best
                            ? "bg-accent/45 text-amber-950"
                            : "bg-black/60"
                    }`}
                >
                    <span className={player.is_self ? "font-semibold" : ""}>
                        {player.label}
                        {player.is_self && " (you)"}
                    </span>
                    <span className="font-mono">{player.score}</span>
                </div>
            ))}
        </div>
    );
}

//------------------------------------------------------------------------------
function GameOverPanel({
    game,
    players,
    onRestart,
}: {
    game: GameState;
    players: Array<Player>;
    onRestart: () => void;
}) {
    const best = players.reduce(
        (best, player) => Math.max(best, player.score),
        0,
    );
    const winners = players.filter(player => player.score === best);

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 p-4">
            <NeonBanner>Game over</NeonBanner>

            <Scoreboard players={players} />

            <p className="text-sm opacity-90">
                {winners.length === players.length && players.length > 1
                    ? "It's a draw!"
                    : `${winners.length > 1 ? "Winners" : "Winner"}: ${winners.map(winner => winner.label).join(", ")}`}
            </p>
            <p className="text-xs opacity-70 tabular-nums">
                Round cleared in{" "}
                {formatDuration(game.ended_at - game.started_at)}
            </p>

            <button className="button button-primary" onClick={onRestart}>
                Restart
            </button>
        </div>
    );
}

//------------------------------------------------------------------------------
function NeonBanner({ children }: { children: string }) {
    return (
        <span
            className="text-4xl font-black uppercase select-none"
            style={{
                color: "#ff2222",
                textShadow:
                    "0 0 10px #ff0000, 0 0 30px #ff0000, 0 0 60px #cc0000, 2px 2px 0 #660000",
            }}
        >
            {children}
        </span>
    );
}

//------------------------------------------------------------------------------
// Read game state from agent's `Game` entity; detect if host disconnected.
function useGame(): {
    game: GameState | null;
    hostLeft: boolean;
    requestRestart: () => void;
} {
    const { instance } = useContext(LivelinkContext);
    const [entity, setEntity] = useState<Entity | null>(null);
    const [game, setGame] = useState<GameState | null>(null);
    const [hostLeft, setHostLeft] = useState(false);

    // Find Game entity under roster (retry on entities-created events).
    useEffect(() => {
        if (!instance || entity) {
            return;
        }
        const { scene } = instance;
        let cancelled = false;

        const find = async (): Promise<void> => {
            try {
                const roster = await scene.findEntity({
                    entity_uuid: AGENT_ROSTER_ENTITY_ID,
                });
                const children = roster ? await roster.getChildren() : [];
                const found = children.find(
                    child => child.name === GAME_ENTITY_NAME,
                );
                if (found && !cancelled) {
                    setEntity(found);
                    setHostLeft(false);
                }
            } catch (error) {
                console.error(
                    "Failed to look for the room's game entity",
                    error,
                );
            }
        };

        void find();
        scene.addEventListener("on-entities-created", find);

        return () => {
            cancelled = true;
            scene.removeEventListener("on-entities-created", find);
        };
    }, [instance, entity]);

    // Track game state updates.
    useEffect(() => {
        if (!instance || !entity) {
            return;
        }
        const { scene } = instance;

        const read = () => setGame(readGameState(entity.tags?.value));
        const onUpdated = (event: EntityUpdatedEvent) => {
            if (event.includes("tags")) {
                read();
            }
        };
        const onDeleted = (event: EntitiesDeletedEvent) => {
            if (event.includes(entity)) {
                setEntity(null);
                setGame(null);
                setHostLeft(true);
            }
        };

        read();
        entity.addEventListener("on-entity-updated", onUpdated);
        scene.addEventListener("on-entities-deleted", onDeleted);

        return () => {
            entity.removeEventListener("on-entity-updated", onUpdated);
            scene.removeEventListener("on-entities-deleted", onDeleted);
        };
    }, [instance, entity]);

    // Client-writable tag: bump restart value to ask for fresh swarm.
    const requestRestart = useCallback(() => {
        if (!entity || !game) {
            return;
        }
        const others = (entity.tags?.value ?? []).filter(
            tag => !tag.startsWith(`${RESTART_TAG}=`),
        );
        entity.tags = {
            value: [...others, `${RESTART_TAG}=${game.round + 1}`],
        };
    }, [entity, game]);

    return { game, hostLeft, requestRestart };
}

//------------------------------------------------------------------------------
type Player = {
    client_id: UUID;
    label: string;
    is_self: boolean;
    score: number;
};

//------------------------------------------------------------------------------
// Get all players except hosting agent (sorted by client ID for consistency).
function usePlayers({ game }: { game: GameState | null }): Array<Player> {
    const { instance } = useContext(LivelinkContext);
    const { clients } = useClients();

    const own_client_id = instance?.session.client_id ?? null;

    return [own_client_id, ...clients.map(client => client.id)]
        .filter(
            (client_id): client_id is UUID =>
                client_id !== null && client_id !== game?.host_client_id,
        )
        .sort()
        .map((client_id, index) => ({
            client_id,
            label: `P${index + 1}`,
            is_self: client_id === own_client_id,
            score: game?.scores[client_id] ?? 0,
        }));
}

//------------------------------------------------------------------------------
// Track round elapsed time (live while running, frozen when over).
function useRoundClock(game: GameState | null): number {
    const [, tick] = useReducer((count: number) => count + 1, 0);

    useEffect(() => {
        if (!game || game.is_over) {
            return;
        }
        const timer = setInterval(tick, 100);
        return () => clearInterval(timer);
    }, [game]);

    if (!game) {
        return 0;
    }
    return game.is_over
        ? game.ended_at - game.started_at
        : Date.now() - game.started_at;
}

//==============================================================================
// Agent: runtime-agnostic (can run as Node.js headless service).
//==============================================================================

//------------------------------------------------------------------------------
// Per-room state (mirrored to Game entity tags).
type Room = {
    livelink: AgentLivelink;
    game_entity: AgentEntity;
    animation: OrbitingAnimation | null;
    cubes: Set<AgentEntity>;
    scores: Map<UUID, number>;
    round: number;
    started_at: number;
    // 0 while the round is running.
    ended_at: number;
    detachListeners: () => void;
};

//------------------------------------------------------------------------------
// Game agent: spawns swarm, referees clicks, keeps scoreboard.
function createGameAgent({ config }: { config: AgentConfig }): Agent {
    const agent = new Agent({ config });
    const rooms = new Map<UUID, Room>();

    //--------------------------------------------------------------------------
    // Publish game state to clients (rebuild tag array to drop disconnected players).
    const publishGameState = ({ room }: { room: Room }): void => {
        const value = [
            `host=${room.livelink.session.client_id ?? ""}`,
            `round=${room.round}`,
            `state=${room.ended_at === 0 ? "playing" : "over"}`,
            `cubes=${room.cubes.size}`,
            `started_at=${room.started_at}`,
            `ended_at=${room.ended_at}`,
            ...Array.from(
                room.scores,
                ([client_id, score]) =>
                    `${SCORE_TAG_PREFIX}${client_id}=${score}`,
            ),
        ];

        const restart = parseTags(room.game_entity.tags?.value)[RESTART_TAG];
        if (restart !== undefined) {
            value.push(`${RESTART_TAG}=${restart}`);
        }

        room.game_entity.tags = { value };
    };

    //--------------------------------------------------------------------------
    // Clear board and spawn fresh swarm (or start first round).
    const startRound = async ({ room }: { room: Room }): Promise<void> => {
        const { livelink } = room;
        const { session_id } = livelink.session;

        // Claim round synchronously (prevent competing swarms).
        room.round += 1;
        room.ended_at = 0;
        room.scores.clear();
        room.animation?.stop();
        room.animation = null;

        // Prune cube set (agent deletions don't raise local events).
        const leftovers = Array.from(room.cubes);
        room.cubes.clear();
        if (leftovers.length > 0) {
            await livelink.scene.deleteEntities({ entities: leftovers });
        }

        const animation = await startOrbitingAnimation({
            livelink,
            objects: MATERIAL_REFS.map(material_ref => ({
                material_ref,
                mesh_ref: MESH_REF,
            })),
            tags: [CUBE_TAG],
        });

        // Check if we're still in this room (may have left while spawning).
        if (agent.getLivelink({ session_id }) === null) {
            animation.stop();
            return;
        }

        room.animation = animation;
        room.started_at = Date.now();
        for (const cube of animation.entities) {
            room.cubes.add(cube);
        }

        console.log(
            `Room ${session_id}: round ${room.round} started with ${room.cubes.size} cubes.`,
        );
        publishGameState({ room });
    };

    //--------------------------------------------------------------------------
    // Client cleared cubes; agent awards points (single authority).
    const onCubesCleared = ({
        room,
        event,
    }: {
        room: Room;
        event: AgentEntitiesDeletedEvent;
    }): void => {
        const cleared = Array.from(room.cubes).filter(cube =>
            event.includes(cube),
        );
        if (cleared.length === 0) {
            return;
        }
        for (const cube of cleared) {
            room.cubes.delete(cube);
        }

        if (event.emitter !== null) {
            const { id } = event.emitter;
            room.scores.set(id, (room.scores.get(id) ?? 0) + cleared.length);
        } else {
            // The agent itself never deletes a cube it still tracks, so this should not happen.
            console.warn(
                `Room ${room.livelink.session.session_id}: cubes cleared by nobody.`,
            );
        }

        if (room.cubes.size === 0 && room.ended_at === 0) {
            room.ended_at = Date.now();
            room.animation?.stop();
            room.animation = null;
            console.log(
                `Room ${room.livelink.session.session_id}: round ${room.round} over.`,
            );
        }

        publishGameState({ room });
    };

    //--------------------------------------------------------------------------
    agent.addEventListener("on-session-ready", async ({ livelink }) => {
        const { scene, session } = livelink;
        const { session_id } = session;

        const roster = await scene.findEntity({
            entity_uuid: AGENT_ROSTER_ENTITY_ID,
        });
        if (roster === null) {
            console.error(
                `agent_roster entity missing in session ${session_id}; cannot host a game.`,
            );
            return;
        }

        // The room's state lives next to the agent markers, so clients have a fixed place to look.
        const game_entity = await scene.newEntity({
            name: GAME_ENTITY_NAME,
            parent: roster,
            components: { tags: { value: [] } },
            options: { delete_on_client_disconnection: true },
        });

        if (agent.getLivelink({ session_id }) === null) {
            return;
        }

        const room: Room = {
            livelink,
            game_entity,
            animation: null,
            cubes: new Set(),
            scores: new Map(),
            round: 0,
            started_at: 0,
            ended_at: 0,
            detachListeners: () => {},
        };

        const onEntitiesDeleted = (event: AgentEntitiesDeletedEvent): void =>
            onCubesCleared({ room, event });
        scene.addEventListener("on-entities-deleted", onEntitiesDeleted);

        // Restart request: when restart tag > current round (ignore local edits).
        const onGameEntityUpdated = (event: AgentEntityUpdatedEvent): void => {
            if (!event.isExternal() || !event.includes("tags")) {
                return;
            }
            if (
                readGameState(game_entity.tags?.value).restart_requested >
                room.round
            ) {
                void startRound({ room }).catch((error: Error) =>
                    console.error("Failed to restart the round", error),
                );
            }
        };
        game_entity.addEventListener("on-entity-updated", onGameEntityUpdated);

        room.detachListeners = () => {
            scene.removeEventListener("on-entities-deleted", onEntitiesDeleted);
            game_entity.removeEventListener(
                "on-entity-updated",
                onGameEntityUpdated,
            );
        };

        rooms.set(session_id, room);

        await startRound({ room });
    });

    // Tear down room on disconnect (server deletes Game entity and cubes).
    agent.addEventListener("on-session-left", ({ livelink }) => {
        const { session_id } = livelink.session;
        const room = rooms.get(session_id);
        if (room === undefined) {
            return;
        }
        room.animation?.stop();
        room.detachListeners();
        rooms.delete(session_id);
    });

    return agent;
}
