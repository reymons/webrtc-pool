export default class Peer extends RTCPeerConnection {
    constructor(id, opts) {
        super(opts);
        this.id = id;
        this.remoteIceGatheringState = WebRTC.IceGatheringState.New;
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
        if (!this._candidatesFlushed) {
            for (let candidate of this._candidates) {
                this.addIceCandidate(candidate);
            }
            this._candidatesFlushed = true;
            this._candidates.length = 0;
        }
    }
    
    hasSender(kind) {
        return this.getSenders().some(sender => {
            return sender.track !== null && sender.track.kind === kind;
        });
    }

    replaceTrack(track) {
        let oldTrack = this._stream
            .getTracks()
            .find(t => t.kind === track.kind);
        if (oldTrack) this._stream.removeTrack(oldTrack);
        this._stream.addTrack(track);
    }

    get hasConnectedOnce() {
        return this._connectedTimes > 0;
    }
}

