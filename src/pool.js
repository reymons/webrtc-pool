import { EventEmitter } from "./emitter.js";
import { Peer } from "./peer.js";
import {
    PoolEvent, ChannelEvent, MediaKind, PeerEvent,
    sData, sCreatePeer, sEnsurePeer, sForEachPeer,
    sSetChannel, sFlushCandidates, sToggleLocalMedia,
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

    [sCreatePeer](id) {
        let peer = new Peer(id);
        let peerData = peer[sData];
        let conn = peerData.conn;
        this[sData].peers[id] = peer;

        conn.oniceconnectionstatechange = () => {
            if (conn.iceConnectionState === "connected") {
                if (peerData.connectedTimes === 0) {
                    this.emit(PoolEvent.Connection, peer);
                }
                peerData.connectedTimes += 1;
            }
        };
        conn.onicecandidate = (e) => {
            this.emit(PoolEvent.Candidate, {
                peerId: peer.id,
                candidate: e.candidate,
            });
        };

        peer.on(ChannelEvent.MediaState, ({ kind, enabled }) => {
            this[sForEachPeer](() => {
                peerData.channel?.send(JSON.stringify({
                    type: ChannelEvent.MediaState,
                    data: { kind, enabled }
                }));
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
        if (validate.peerId(id)) {
            let peers = this[sData].peers;
            let peer = peers[id];
            if (peer !== undefined) {
                peer[sData].conn.close();
                peer.emit(PeerEvent.Disconnect, peer);
                delete peers[id];
            }
        }
    }

    closeAllPeers() {
        this[sForEachPeer](peer => this.closePeer(peer.id));
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

