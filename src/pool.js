import Peer from "./peer";
import Mutex from "./mutex";
import EventEmitter from "./event";
import { Event, Track, SelfId, IceGatheringState } from "./dict";

function EventSender() {
    let event = new EventEmitter();

    let body = (peerId, data) => {
        data.peerId = peerId;
        return data;
    };

    return {
        event,
        error(err) {
            event.emit(Event.Error, err);
        },
        offer(peerId, offer) {
            event.emit(Event.Offer, body(peerId, { offer }));
        },
        answer(peerId, answer) {
            event.emit(Event.Answer, body(peerId, { answer }));
        },
        candidate(peerId, candidateInfo) {
            event.emit(Event.Candidate, body(peerId, { candidateInfo }));
        },
        peerConnected(peerId) {
            event.emit(Event.PeerConnected, body(peerId, {}));
        },
        peerDisconnected(peerId) {
            event.emit(Event.PeerDisconnected, body(peerId, {}));
        },
        message(peerId, data) {
            event.emit(Event.Message, body(peerId, { data }));
        },
        trackStateChanged(peerId, kind, enabled) {
            event.emit(Event.TrackStateChanged, body(peerId, { kind, enabled }));
        },
        mediaStream(peerId, stream) {
            event.emit(Event.MediaStream, body(peerId, { stream }));
        },
    }
}

export default function Pool() {
    let peers = {};
    let mtx = new Mutex();
    let track = { audio: null, video: null };
    let send = EventSender();

    let createPeer = id => {
        let peer = new Peer(id, {
            iceServers:  [
                { urls: "stun:stun.l.google.com:19302" },
                {
                    urls: "turn:turn01.hubl.in?transport=udp",
                    username: "user",
                    credential: "123qwe"
                }
            ]
        });
        peer.onnegotiationneeded = () => {
            // Re-make an offer only when there's an active connection.
            // When a user gets in with, for example, their mic turned on,
            // this event is still going be fired
            // which will lead to makeOffer() called multiple times
            if (peer.connectedTimes > 0) {
                makeOffer(peer.id);
            }
        };
        peer.ontrack = e => {
            peer.replaceTrack(e.track);
            send.mediaStream(peer.id, peer.stream);
        };
        peer.onicecandidate = e => {
            send.candidate(peer.id, {
                candidate: e.candidate,
                gatheringState: peer.iceGatheringState,
            });
        };
        peer.onconnectionstatechange = () => {
            if (peer.connectionState === "connected") {
                if (peer.connectedTimes === 0) {
                    send.peerConnected(peer.id);
                }
                peer.connectedTimes += 1;
            }
        };
        return peer;
    };

    let getPeer = id => {
        return peers[id] ?? null;
    };
    let setPeer = (id, peer) => {
        peers[id] = peer;
    };
    let ensurePeer = id => {
        return getPeer(id) ?? createPeer(id);
    };
    let removePeer = id => {
        let peer = getPeer(id);
        if (peer !== null) {
            delete this._peers[id];
            send.peerDisconnected(id);
        }
    }
    let forEachPeer = cb => {
        for (let id in this._peers) {
            cb(this._peers[id]);
        }
    }
    let setPeerChannel = (peer, channel) => {
        channel.onmessage = e => send.message(peer.id, e.data);
        peer.channel.public = channel;
    }

    let requestUserMedia = kind => {
        return navigator.mediaDevices.getUserMedia({ [kind]: true })
            .catch(() => null);
    }
    let addTrackIfExists = (peer, kind) => {
        if (this._track[kind] !== null) {
            if (!peer.hasSender(kind)) {
                peer.addTrack(this._track[kind]);
            }
        }
    }

    let makeOffer = async peerId => {
        let peer = ensurePeer(peerId);
        if (peer.channel.public === null) {
            setPeerChannel(peer, peer.createDataChannel("public"));
        }
        addTrackIfExists(peer, Track.Audio);
        addTrackIfExists(peer, Track.Video);
        let offer = await peer.createOffer();
        if (offer.sdp !== undefined) {
            await peer.setLocalDescription(offer);
            setPeer(peerId, peer);
            send.offer(peerId, { sdp: offer.sdp });
        } else {
            send.error(new Error("No sdp"));
        }
    }
    
    let acceptOffer = async (peerId, offer) => {
        await mtx.lock();
        let peer = ensurePeer(peerId);
        if (peer.channel.public === null) {
            peer.ondatachannel = e => setPeerChannel(peer, e.channel);
        }
        addTrackIfExists(peer, Track.Audio);
        addTrackIfExists(peer, Track.Video);
        let desc = new RTCSessionDescription({ type: "offer", sdp: offer.sdp }); 
        await peer.setRemoteDescription(desc);
        let answer = await peer.createAnswer();
        if (answer.sdp !== undefined) {
            await peer.setLocalDescription(answer);
            if (peer.remoteIceGatheringState === IceGatheringState.Complete) {
                peer.flushCandidates();
            }
            setPeer(peerId, peer);
            send.answer(peerId, { sdp: answer.sdp });
        } else {
            send.error(new Error("No sdp"));
        }
        mtx.unlock();
    }

    let acceptAnswer = async (peerId, answer) => {
        let peer = getPeer(peerId);
        if (peer === null) {
            send.error(new Error("No peer"));
            return;
        }
        let desc = new RTCSessionDescription({ type: "answer", sdp: answer.sdp });
        await peer.setRemoteDescription(desc);
        if (peer.remoteIceGatheringState === IceGatheringState.Complete) {
            peer.flushCandidates();
        }
    }

    addCandidate = async (peerId, candidateInfo) => {
        await mtx.lock();
        let peer = ensurePeer(peerId);
        setPeer(peerId, peer);
        peer.remoteIceGatheringState = candidateInfo.gatheringState;
        // If true, candidateInfo.candidate is null so we don't add them
        if (candidateInfo.gatheringState === IceGatheringState.Complete) {
            if (peer.signalingState === "have-remote-offer" ||
                peer.signalingState === "have-remote-pranswer" ||
                peer.signalingState === "stable"
            ) {
                peer.flushCandidates(peer);
            }
        } else {
            peer.candidates.push(candidateInfo.candidate);
        }
        mtx.unlock();
    }

    let setUserMedia = async (kind, enabled) => {
        if (kind !== Track.Audio && kind !== Track.Video) {
            send.error(new Error("Invalid track kind"));
            return;
        }
        if (track[kind] !== null) {
            track[kind].enabled = enabled;
            send.trackStateChanged(SelfId, kind, enabled);
            return;
        }
        if (!enabled) return;

        let stream = await requestUserMedia(kind);
        if (stream === null) return;

        let tracks = kind === Track.Audio
            ? stream.getAudioTracks()
            : stream.getVideoTracks();

        let newTrack = tracks.at(0);
        if (newTrack === undefined) {
            send.error(new Error("No track"));
            return;
        }

        track[kind] = newTrack;

        newTrack.onended = () => {
            track[kind] = null;
            forEachPeer(peer => {
                let sender = peer
                    .getSenders()
                    .find(s => s.track?.id === newTrack.id);

                peer.removeTrack(sender);
                send.trackStateChanged(SelfId, kind, false);
            });
        }

        forEachPeer(peer => peer.addTrack(newTrack));
        send.trackStateChanged(SelfId, kind, true);
    }

    return {
        makeOffer,
        acceptOffer,
        acceptAnswer,
        addCandidate,
        removePeer,
        get localAudioEnabled() {
            let track = track[Track.Audio];
            return track !== null && track.enabled;
        },
        get localVideoEnabled() {
            let track = track[Track.Video];
            return track !== null && track.enabled;
        },
        enableLocalAudio: () => { setUserMedia(Track.Audio, true) },
        disableLocalAudio: () => { setUserMedia(Track.Audio, false) },
        enableLocalVideo: () => { setUserMedia(Track.Video, true) },
        disableLocalVideo: () => { setUserMedia(Track.Video, false) },
        send: (peerId, data) => {
            let peer = getPeer(peerId)
            peer?._channel.public.send(data);
        },
        sendToAll: data => {
            forEachPeer(peer => peer.channel.public.send(data));
        }
    }
}
