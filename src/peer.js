import { IceGatheringState } from "./dict";

export default class Peer extends RTCPeerConnection {
    constructor(id, opts) {
        super(opts);
        this.id = id;
        this.remoteIceGatheringState = IceGatheringState.New;
        this.candidatesFlushed = false;
        this.candidates = [];
        this.stream = new MediaStream();
        this.connectedTimes = 0;
        this.channel = {
            public: null,
            private: null
        };
    }

    flushCandidates() {
        if (!this.candidatesFlushed) {
            for (let candidate of this.candidates) {
                this.addIceCandidate(candidate);
            }
            this.candidatesFlushed = true;
            this.candidates.length = 0;
        }
    }
    
    hasSender(kind) {
        return this.getSenders().some(sender => {
            return sender.track !== null && sender.track.kind === kind;
        });
    }

    replaceTrack(track) {
        let oldTrack = this.stream
            .getTracks()
            .find(t => t.kind === track.kind);
        if (oldTrack) this.stream.removeTrack(oldTrack);
        this.stream.addTrack(track);
    }

    get hasConnectedOnce() {
        return this.connectedTimes > 0;
    }
}

