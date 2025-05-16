export const Event = Object.freeze({ 
    Error: "error",
    Offer: "offer",
    Answer: "answer",
    Candidate: "candidate",
    PeerDisconnected: "peerdisconnected",
    PeerConnected: "peerconnected",
    MediaStream: "mediastream",
    TrackStateChanged: "trackstatechanged",
    Message: "message",
});

export const IceGatheringState = Object.freeze({
    New: "new",
    Gathering: "gathering",
    Complete: "complete",
});

export const Track = Object.freeze({
    Audio: "audio",
    Video: "video",
});

export const SelfId = "self";

