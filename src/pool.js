import { EventEmitter } from "./emitter.js";
import { AbstractPeer, Peer } from "./peer.js";
import {
    PoolEvent, ChannelEvent, MediaKind,
    sData, sCreatePeer, sEnsurePeer, sForEachPeer, sSend,
    sSetChannel, sFlushCandidates, sToggleLocalMedia,
    PoolPeerEvent,
} from "./dict.js";
import { requestUserMediaStream, validate } from "./utils.js";

function emitInvalidPeerId(pool) {
    pool.emit(PoolEvent.Error, new Error("Invalid peer id"));
}

export class Pool extends EventEmitter {
    constructor() {
        super();

        this[sData] = {
            peers: {},
            localStream: { audio: null, video: null }
        }
    }

    [sCreatePeer](id, abstract = false) {
        let peer = abstract ? new AbstractPeer(id) : new Peer(id);
        this[sData].peers[id] = peer;

        peer.on(PoolPeerEvent.Connection, () => {
            this.emit(PoolEvent.Connection, peer);
        });

        peer.on(PoolPeerEvent.Candidate, (candidate) => {
            this.emit(PoolEvent.Candidate, { peerId: peer.id, candidate });
        });

        peer.on(PoolPeerEvent.Disconnect, () => {
            Reflect.deleteProperty(this[sData].peers, peer.id);
        });

        peer.on(PoolPeerEvent.MediaState, ({ kind, enabled }) => {
            this[sForEachPeer](peer => {
                peer[sSend](ChannelEvent.MediaState, { kind, enabled });
            });
        });

        return peer;
    }

    [sEnsurePeer](id) {
        return this[sData].peers[id] ?? this[sCreatePeer](id);
    }

    [sForEachPeer](cb) {
        let { peers } = this[sData];
        for (let id in peers) cb(peers[id]);
    }

    closePeer(id) {
        let peer = this[sData].peers[id];
        peer?.close();
    }

    closeAllPeers() {
        this[sForEachPeer](peer => peer.close());
    }

    connectAbstractPeer(id) {
        if (id !== undefined && !validate.peerId(id)) {
            emitInvalidPeerId();
            return;
        }
        id = id ?? crypto.randomUUID().substring(0, 8);
        let peer = this[sCreatePeer](id, true);
        this.emit(PoolEvent.Connection, peer);
    }

    async makeOffer(peerId) {
        if (!validate.peerId(peerId)) {
            emitInvalidPeerId(this);
            return;
        }
        let peer = this[sEnsurePeer](peerId);
        let conn = peer[sData].conn;
        try {
            let channel = conn.createDataChannel("signaler");
            peer[sSetChannel](channel);
            conn.addTransceiver(MediaKind.Audio, { direction: "sendrecv" });
            conn.addTransceiver(MediaKind.Video, { direction: "sendrecv" });
            let { audio, video } = this[sData].localStream;
            if (audio !== null) conn.addTrack(audio);
            if (video !== null) conn.addTrack(video);
            let offer = await conn.createOffer();
            await conn.setLocalDescription(offer);
            this.emit(PoolEvent.Offer, { peerId: peer.id, offer });
        } catch (error) {
            this.emit(PoolEvent.Error, error);
        }
    }

    async acceptOffer(offer, peerId) {
        if (!validate.peerId(peerId)) {
            emitInvalidPeerId(this);
            return;
        }
        let peer = this[sEnsurePeer](peerId);
        let conn = peer[sData].conn;
        try {
            conn.ondatachannel = (e) => {
                peer[sSetChannel](e.channel);
            };
            await conn.setRemoteDescription(offer);
            conn.getTransceivers().forEach(transceiver => {
                transceiver.direction = "sendrecv";
            });
            let { audio, video } = this[sData].localStream;
            if (audio !== null) conn.addTrack(audio);
            if (video !== null) conn.addTrack(video);
            let answer = await conn.createAnswer();
            await conn.setLocalDescription(answer);
            peer[sFlushCandidates]();
            this.emit(PoolEvent.Answer, { peerId: peer.id, answer });
        } catch (error) {
            this.emit(PoolEvent.Error, error);
        }
    }

    async acceptAnswer(answer, peerId) {
        if (!validate.peerId(peerId)) {
            emitInvalidPeerId(this);
            return;
        }
        let peer = this[sEnsurePeer](peerId);
        let conn = peer[sData].conn;
        try {
            await conn.setRemoteDescription(answer);
            peer[sFlushCandidates]();
        } catch (error) {
            this.emit(PoolEvent.Error, error);
        }
    }

    async addCandidate(candidate, peerId) {
        if (!validate.peerId(peerId)) {
            emitInvalidPeerId(this);
            return;
        }
        let peer = this[sEnsurePeer](peerId);
        let { conn, candidates } = peer[sData];
        candidates.push(candidate);

        if (conn.signalingState === "have-remote-offer" ||
            conn.signalingState === "have-remote-pranswer" ||
            conn.signalingState === "stable"
        ) {
            try {
                peer[sFlushCandidates]();
            } catch (error) {
                this.emit(PoolEvent.Error, error);
            }
        }
    }

    get localAudioEnabled() {
        return this[sData].localStream.audio !== null;
    }

    get localVideoEnabled() {
        return this[sData].localStream.video !== null;
    }

    async [sToggleLocalMedia](kind, currentlyEnabled, force) {
        let enabled = force ?? !currentlyEnabled;
        let { localStream } = this[sData];
        if (enabled) {
            let stream = await requestUserMediaStream({ [kind]: true });
            if (stream === null) return;
            localStream[kind] = stream.getTracks()[0];
        } else {
            localStream[kind]?.stop();
            localStream[kind] = null;
        }
        this[sForEachPeer](peer => {
            if (kind === MediaKind.Video) peer.toggleLocalVideo(enabled);
            else if (kind === MediaKind.Audio) peer.toggleLocalAudio(enabled);
        });
    }

    toggleLocalAudio(force) {
        this[sToggleLocalMedia](MediaKind.Audio, this.localAudioEnabled, force);
    }

    toggleLocalVideo(force) {
        this[sToggleLocalMedia](MediaKind.Video, this.localVideoEnabled, force);
    }

    toggleRemoteAudio(force) {
        this[sForEachPeer](peer => peer.toggleRemoteAudio(force));
    }

    toggleRemoteVideo(force) {
        this[sForEachPeer](peer => peer.toggleRemoteVideo(force));
    }
}

