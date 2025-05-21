// Common
export const sData = Symbol("_data");
export const sToggleLocalMedia = Symbol("_toggleLocalMedia");
export const sToggleRemoteMedia = Symbol("_toggleRemoteMedia");

// EventEmitter
export const sEventData = Symbol("_eventData");

// Peer
export const sFlushCandidates = Symbol("_flushCandidates");
export const sSetChannel = Symbol("_setChannel");

// Pool
export const sCreatePeer = Symbol("_createPeer");
export const sEnsurePeer = Symbol("_ensurePeer");
export const sForEachPeer = Symbol("_forEachPeer");

export const PoolEvent = Object.freeze({
    Connection: "connection",
    Error: "error",
    Offer: "offer",
    Answer: "answer",
    Candidate: "candidate"
});

export const PeerEvent = Object.freeze({
    Disconnect: "disconnect",
    Message: "message",
});

export const MediaKind = Object.freeze({
    Audio: "audio",
    Video: "video",
});

export const ChannelEvent = Object.freeze({
    MediaState: "mediastate",
    UserMessage: "usermessage",
});
