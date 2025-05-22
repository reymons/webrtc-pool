import { EventEmitter } from "./emitter.js";
import { requestUserMediaStream, is } from "./utils.js";
import {
    PeerEvent, ChannelEvent, MediaKind, PoolPeerEvent,
    sData, sFlushCandidates, sToggleLocalMedia, sToggleRemoteMedia,
    sSetChannel, sSend, sClose
} from "./dict.js";

class PoolPeer extends EventEmitter {
    constructor(id, abstract) {
        super();
        if (this.constructor.prototype === PoolPeer.prototype) {
            throw new Error("This is an abstract class");
        }
        this[sData] = {
            id,
            abstract,
            remoteStream: new MediaStream(),
        };
    }

    get id() {
        return this[sData].id;
    }

    get remoteStream() {
        return this[sData].remoteStream;
    }

    get abstract() {
        return this[sData].abstract;
    }

    [sClose]() {
        let { remoteStream } = this[sData];
        remoteStream.getTracks().forEach(track => track.stop());
        this.emit(PeerEvent.Disconnect);
        this.emit(PoolPeerEvent.Disconnect);
    }
}

export class Peer extends PoolPeer {
    constructor(id) {
        super(id, false);

        let conn = new RTCPeerConnection();

        conn.oniceconnectionstatechange = () => {
            if (conn.iceConnectionState === "connected") {
                let data = this[sData];
                if (!data.connectedOnce) {
                    this.emit(PoolPeerEvent.Connection);
                }
                data.connectedOnce = true;
            }
        };

        conn.onicecandidate = (e) => {
            this.emit(PoolPeerEvent.Candidate, e.candidate);
        };

        Object.assign(this[sData], {
            conn,
            candidates: [],
            connectedOnce: false,
            channel: null,
        });
    }

    get id() {
        return this[sData].id;
    }

    get remoteStream() {
        return this[sData].remoteStream;
    }

    [sFlushCandidates]() {
        let { candidates, conn } = this[sData];
        for (let candidate of candidates) {
            conn.addIceCandidate(candidate);
        }
        candidates.length = 0;
    }

    [sSetChannel](channel) {
        this[sData].channel = channel;

        channel.onopen = () => {
            this[sSend](ChannelEvent.MediaState, {
                kind: MediaKind.Audio,
                enabled: this.localAudioEnabled,
            });
            this[sSend](ChannelEvent.MediaState, {
                kind: MediaKind.Video,
                enabled: this.localVideoEnabled,
            });
        };

        channel.onmessage = e => {
            let parsedMessage = parseChannelMessage(e.data);
            if (parsedMessage === null) return;
            let { type, data } = parsedMessage;
            let { conn, remoteStream } = this[sData];

            switch (type) {
                case ChannelEvent.MediaState: {
                    let receivers = conn.getReceivers();
                    let receiver = receivers.find(r => r.track.kind === data.kind);
                    if (receiver !== undefined) {
                        if (data.enabled) {
                            remoteStream.addTrack(receiver.track);
                        } else {
                            remoteStream.removeTrack(receiver.track);
                        }
                        emitRemoteMediaChange(this);
                    }
                    break;
                }
                case ChannelEvent.UserMessage:
                    this.emit(PeerEvent.Message, data);
                    break;
            }
        };
    }

    [sToggleRemoteMedia](kind, force) {
        let { conn } = this[sData];
        let receiver = conn.getReceivers().find(r => r.track?.kind === kind);
        if (receiver !== undefined) {
            receiver.track.enabled = force ?? !receiver.track.enabled;
        }
    }

    async [sToggleLocalMedia](kind, force) {
        let { conn } = this[sData];
        let sender = null;
        for (let t of conn.getTransceivers()) {
            if (t.receiver.track?.kind === kind) {
                sender = t.sender;
                break;
            }
        }
        if (sender === null) return;
        if (force && sender.track?.readyState === "live") return;
        if (force === false && (!sender.track || sender.track.readyState === "ended")) {
            return;
        }
        if (sender.track?.readyState === "live") {
            sender.track.stop();
            this.emit(PoolPeerEvent.MediaState, { kind, enabled: false });
            emitLocalMediaChange(this);
            return;
        }
        let stream = await requestUserMediaStream({ [kind]: true });
        if (stream !== null) {
            let newTrack = stream.getTracks()[0];
            sender.replaceTrack(newTrack);
            this.emit(PoolPeerEvent.MediaState, { kind, enabled: true });
            emitLocalMediaChange(this);
        }
    }

    get localAudioEnabled() {
        let sender = this[sData].conn.getSenders().find(
            s => s.track?.kind === MediaKind.Audio
        );
        return sender?.track?.readyState === "live";
    }

    get localVideoEnabled() {
        let sender = this[sData].conn.getSenders().find(
            s => s.track?.kind === MediaKind.Video
        );
        return sender?.track?.readyState === "live";
    }

    get remoteAudioEnabled() {
        return !!this[sData].remoteStream.getAudioTracks()[0];
    }

    get remoteVideoEnabled() {
        return !!this[sData].remoteStream.getVideoTracks()[0];
    }

    toggleLocalAudio(force) {
        this[sToggleLocalMedia](MediaKind.Audio, force);
    }

    toggleLocalVideo(force) {
        this[sToggleLocalMedia](MediaKind.Video, force);
    }

    toggleRemoteAudio(force) {
        this[sToggleRemoteMedia](MediaKind.Audio, force);
    }

    toggleRemoteVideo(force) {
        this[sToggleRemoteMedia](MediaKind.Video, force);
    }

    [sSend](type, data) {
        this[sData].channel?.send(JSON.stringify({
            type,
            data
        }));
    }

    sendMessage(message) {
        this[sSend](type, message);
    }

    close() {
        try {
            this[sData].conn.close();
            this[sClose]();
        } catch (err) {
            this.emit(PeerEvent.Error, err);
        }
    }
}

export class AbstractPeer extends PoolPeer {
    constructor(id) {
        super(id, true);
        this[sData].track = {
            [MediaKind.Audio]: null,
            [MediaKind.Video]: null,
        };
    }

    get localAudioEnabled() {
        return this[sData].track.audio !== null;
    }

    get localVideoEnabled() {
        return this[sData].track.video !== null;
    }

    get remoteAudioEnabled() {
        return this[sData].track.audio !== null;
    }

    get remoteVideoEnabled() {
        return this[sData].track.video !== null;
    }

    async [sToggleRemoteMedia](kind, force) {
        let { remoteStream, track } = this[sData];
        let enabled = track[kind] !== null;

        if (force && enabled) return;
        if (force === false && !enabled) return;

        if (enabled) {
            remoteStream.removeTrack(track[kind]);
            track[kind] = null;
        } else {
            let stream = await requestUserMediaStream({ [kind]: true });
            if (stream === null) return;
            let newTrack = stream.getTracks()[0];
            remoteStream.addTrack(newTrack);
            track[kind] = newTrack;
        }
        emitRemoteMediaChange(this);
    }

    toggleLocalAudio(force) {
        this[sToggleRemoteMedia](MediaKind.Audio, force);
    }

    toggleLocalVideo(force) {
        this[sToggleRemoteMedia](MediaKind.Video, force);
    }

    toggleRemoteAudio() {
        this[sToggleRemoteMedia](MediaKind.Audio, force);
    }

    toggleRemoteVideo() {
        this[sToggleRemoteMedia](MediaKind.Video, force);
    }

    close() {
        this[sClose]();
    }

    /* No implementation required for these methods */
    [sSend]() {} 
    sendMessage() {} 
}

function emitRemoteMediaChange(peer) {
    peer.emit(PeerEvent.RemoteMediaChange, { peer });
}

function emitLocalMediaChange(peer) {
    peer.emit(PeerEvent.LocalMediaChange, { peer });
}

export function parseChannelMessage(message) {
    try {
        let { type, data } = JSON.parse(message);
        if (typeof type !== "string" || !is.obj(data)) return null;
        return { type, data };
    } catch {
        return null;
    }
}

