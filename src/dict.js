// Common
export const sData = Symbol("_data");
export const sToggleLocalMedia = Symbol("_toggleLocalMedia");
export const sToggleRemoteMedia = Symbol("_toggleRemoteMedia");

// EventEmitter
export const sEventData = Symbol("_eventData");

// Peer
export const sFlushCandidates = Symbol("_flushCandidates");
export const sSetChannel = Symbol("_setChannel");
export const sSend = Symbol("_send");
export const sClose = Symbol("_close");

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
    Error: "error",
    Disconnect: "disconnect",
    Message: "message",
    RemoteMediaChange: "remotemediachange",
    LocalMediaChange: "localmediachange"
});

export const MediaKind = Object.freeze({
    Audio: "audio",
    Video: "video",
});

export const ChannelEvent = Object.freeze({
    MediaState: "mediastate",
    UserMessage: "usermessage",
});

export const PoolPeerEvent = Object.freeze({
    Connection: "pool_connection",
    Disconnect: "pool_disconnect",
    Candidate: "pool_candidate",
    MediaState: "pool_mediastate",
})

