type PeerId = string;
type MessageData = string | Blob | ArrayBuffer | ArrayBufferView;
type WithPeerId<T extends Record<string, any>> = { peerId: PeerId } & T;

type WebRTCEventType = keyof WebRTCEventMap;

type WebRTCEventMap = {
    "error": Error;
    "offer": WithPeerId<{ offer: Offer }>;
    "answer": WithPeerId<{ answer: Answer }>;
    "candidate": WithPeerId<{ candidateInfo: CandidateInfo }>;
    "peerdisconnected": WithPeerId<{}>;
    "peerconnected": WithPeerId<{}>;
    "mediastream": WithPeerId<{ stream: MediaStream }>;
    "trackstatechanged": WithPeerId<{ kind: typeof Track; enabled: boolean }>;
    "message": WithPeerId<{ data: MessageData }>;
};

declare interface Offer {
    sdp: string;
}

declare interface Answer {
    sdp: string;
}

declare interface CandidateInfo {
    candidate: RTCIceCandidateInit;
    gatheringState: RTCIceGathererState;
}

declare function Pool(): {
    event: {
        on<T extends WebRTCEventType>(type: T, listener: (data: WebRTCEventMap[T]) => void): void;
        off<T extends WebRTCEventType>(type: T, listener: (data: WebRTCEventMap[T]) => void): void;
        map(schema: Partial<{
            [E in keyof WebRTCEventMap]: (data: WebRTCEventMap[E]) => void;
        }>): void;
    };
    makeOffer: (peerId: PeerId) => Promise<void>;
    acceptOffer: (peerId: PeerId, offer: Offer) => Promise<void>;
    acceptAnswer: (peerId: PeerId, answer: Answer) => Promise<void>;
    addCandidate: (peerId: PeerId, info: CandidateInfo) => Promise<void>;
    removePeer: (peerId: PeerId) => void;
    localAudioEnabled: boolean;
    localVideoEnabled: boolean;
    enableLocalAudio: () => void;
    enableLocalVideo: () => void;
    disableLocalAudio: () => void;
    disableLocalVideo: () => void;
    send: (peerId: PeerId, data: MessageData) => void;
    sendToAll: (data: MessageData) => void;
}

declare const PoolEvent: {
    Error: "error",
    Offer: "offer",
    Answer: "answer",
    Candidate: "candidate",
    PeerDisconnected: "peerdisconnected",
    PeerConnected: "peerconnected",
    MediaStream: "mediastream",
    TrackStateChanged: "trackstatechanged",
    Message: "message",
}
declare const SelfId: string;
declare const Track: "audio" | "video";
