type PeerId = string;
type MessageData = string | Blob | ArrayBuffer | ArrayBufferView;
type BasePoolEvent<T extends Record<string, any>> = { peerId: PeerId } & T;

type Offer = { type: "offer"; sdp: string; }
type Answer = { type: "answer"; sdp: string; }
type Candidate = RTCIceCandidateInit

type PoolEventMap = {
    "error": Error;
    "offer": BasePoolEvent<{ offer: Offer }>;
    "answer": BasePoolEvent<{ answer: Answer }>;
    "candidate": BasePoolEvent<{ candidate: Candidate }>;
    "connection": PoolPeer;
}

type PeerEventMap = {
    "error": Error;
    "disconnect": never;
    "message": unknown;
    "remotemediachange": unknown;
    "localmediachange": unknown;
}

type MediaKindType = 
    | "audio"
    | "video"

declare const PoolEvent: {
    Connection: "connection",
    Error: "error",
    Offer: "offer",
    Answer: "answer",
    Candidate: "candidate"
}

declare const PeerEvent: {
    Error: "error",
    Disconnect: "disconnect",
    Message: "message",
    RemoteMediaChange: "remotemediachange",
    LocalMediaChange: "localmediachange"
}

declare const MediaKind: {
    Audio: "audio",
    Video: "video",
}

declare class EventEmitter<EventMap extends Record<string, any>> {
    on<E extends keyof EventMap>(event: E, listener: (data: EventMap[E]) => void): () => void;
    off<E extends keyof EventMap>(event: E, listener: (data: EventMap[E]) => void): void;
    emit<E extends keyof EventMap>(event: E, data: EventMap[E]): void;
}

declare class WebRTCPool extends EventEmitter<PoolEventMap> {
    makeOffer(peerId: PeerId): Promise<void>;
    acceptOffer(offer: Offer, peerId: PeerId): Promise<void>;
    acceptAnswer(answer: Answer, peerId: PeerId): Promise<void>;
    addCandidate(candidate: Candidate, peerId: PeerId): Promise<void>;
    connectAbstractPeer(id?: PeerId): void;
    closePeer(peerId: PeerId): void;
    closeAllPeers(): void;
    get localAudioEnabled(): boolean;
    get localVideoEnabled(): boolean;
    toggleLocalAudio(force?: boolean): void;
    toggleLocalVideo(force?: boolean): void;
    toggleRemoteAudio(force?: boolean): void;
    toggleRemoteVideo(force?: boolean): void;
}

declare class PoolPeer extends EventEmitter<PeerEventMap> {
    get id(): PeerId;
    get remoteStream(): MediaStream;
    get abstract(): boolean;
    get localAudioEnabled(): boolean;
    get localVideoEnabled(): boolean;
    get remoteAudioEnabled(): boolean;
    get remoteVideoEnabled(): boolean;
    toggleLocalAudio(force?: boolean): void;
    toggleLocalVideo(force?: boolean): void;
    toggleRemoteAudio(force?: boolean): void;
    toggleRemoteVideo(force?: boolean): void;
    sendMessage(message: string): void;
    close(): void;
}

declare function createPool(): WebRTCPool;

export {
    WebRTCPool,
    PoolPeer,
    PoolEvent,
    PeerEvent,
    MediaKind,
    MediaKindType,
    PoolEventMap,
    PeerEventMap,
    createPool,
};

