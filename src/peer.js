import { EventEmitter } from "./emitter.js";
import {
    PeerEvent, ChannelEvent, MediaKind,
    sData, sFlushCandidates, sToggleLocalMedia, sToggleRemoteMedia,
    sSetChannel
} from "./dict.js";
import { requestUserMediaStream, is } from "./utils.js";

export class Peer extends EventEmitter {
    constructor(id) {
        super();
        this[sData] = {
            id,
            remoteStream: new MediaStream(),
            conn: new RTCPeerConnection(),
            candidates: [],
            connectedTimes: 0,
            channel: null,
        };
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
            channel.send(JSON.stringify({
                type: ChannelEvent.MediaState,
                data: {
                    kind: MediaKind.Audio,
                    enabled: this.localAudioEnabled,
                }
            }));
            channel.send(JSON.stringify({
                type: ChannelEvent.MediaState,
                data: {
                    kind: MediaKind.Video,
                    enabled: this.localVideoEnabled,
                }
            }));
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
            this.emit(ChannelEvent.MediaState, { kind, enabled: false });
            return;
        }
        let stream = await requestUserMediaStream({ [kind]: true });
        if (stream !== null) {
            let newTrack = stream.getTracks()[0];
            sender.replaceTrack(newTrack);
            this.emit(ChannelEvent.MediaState, { kind, enabled: true });
        }
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

    sendMessage(message) {
        this[sData].channel?.send(JSON.stringify(message));
    }
}

function parseChannelMessage(message) {
    try {
        let { type, data } = JSON.parse(message);
        if (typeof type !== "string" || !is.obj(data)) return null;
        return { type, data };
    } catch {
        return null;
    }
}
