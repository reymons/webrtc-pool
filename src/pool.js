import { Peer } from "./peer.js";
import { Mutex } from "./mutex.js";
import { EventSender } from "./event.js";
import { Track, SelfId, IceGatheringState } from "./dict.js";
import { is, validate } from "./utils.js";

export function Pool() {
    let peers = {};
    let mtx = new Mutex();
    let track = { audio: null, video: null };
    let send = EventSender();

    let sendError = e => {
        let err = e instanceof Error ? e : new Error("Unknown error");
        send.error(err);
    };

    let errorBoundary = (cb, errorCb = null) => {
        try {
            let val = cb();
            if (is.promise(val)) {
                val.catch(err => {
                    sendError(err);
                    errorCb?.();
                });
            }
        } catch (err) {
            sendError(err);
            errorCb?.();
        }
    };

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
            send.mediastream(peer.id, peer.stream);
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
                    send.peerconnected(peer.id);
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
            delete peers[id];
            peer.close();
            send.peerdisconnected(id);
        }
    }
    let removeAllPeers = () => {
        forEachPeer(peer => removePeer(peer.id));
    }
    let forEachPeer = cb => {
        for (let id in peers) {
            cb(peers[id]);
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
        if (track[kind] !== null) {
            if (!peer.hasSender(kind)) {
                peer.addTrack(track[kind]);
            }
        }
    }

    let _makeOffer = async peerId => {
        if (!validate.peerId(peerId)) {
            throw new Error("Invalid peerId");
        }
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
            throw new Error("No sdp");
        }
    }
    let makeOffer = peerId => {
        errorBoundary(() => _makeOffer(peerId));
    };
    
    let _acceptOffer = async (peerId, offer, _mtx) => {
        if (!validate.peerId(peerId)) {
            throw new Error("Invalid peer id");
        }
        if (!validate.offer(offer)) {
            throw new Error("Invalid offer");
        }
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
    let acceptOffer = (peerId, offer) => {
        errorBoundary(
            () => _acceptOffer(peerId, offer),
            // If throws, unlock mutex here, otherwise it's gonna be locked forevah
            () => mtx.unlock(),
        );
    };

    let _acceptAnswer = async (peerId, answer) => {
        let peer = getPeer(peerId);
        if (peer === null) throw new Error("No peer");
        let desc = new RTCSessionDescription({ type: "answer", sdp: answer.sdp });
        await peer.setRemoteDescription(desc);
        if (peer.remoteIceGatheringState === IceGatheringState.Complete) {
            peer.flushCandidates();
        }
    };
    let acceptAnswer = (peerId, answer) => {
        errorBoundary(() => _acceptAnswer(peerId, answer));
    };

    let addCandidate = async (peerId, candidateInfo) => {
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
            send.trackstatechanged(SelfId, kind, enabled);
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
                send.trackstatechanged(SelfId, kind, false);
            });
        }

        forEachPeer(peer => peer.addTrack(newTrack));
        send.trackstatechanged(SelfId, kind, true);
    }

    return {
        event: send.event,
        makeOffer,
        acceptOffer,
        acceptAnswer,
        addCandidate,
        removePeer,
        removeAllPeers,
        get localAudioEnabled() {
            let t = track[Track.Audio];
            return t !== null && t.enabled;
        },
        get localVideoEnabled() {
            let t = track[Track.Video];
            return t !== null && t.enabled;
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
