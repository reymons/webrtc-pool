var WebRTC = (...args) => new WebRTC.WebRTC(...args);

(function (m) {
    class WebRTCEventEmitter {
        _eventHash = crypto.randomUUID().substring(0, 8);
        
        _eventName(type) {
            return `__${this._eventHash}_${type}`;
        }
        
        on(type, listener) {
            window.addEventListener(this._eventName(type), e => {
                listener(e.detail);
            });
        }
    
        emit(type, detail) {
            const ev = new CustomEvent(this._eventName(type), { detail });
            window.dispatchEvent(ev);
        }
    
        map(schema) {
            for (const event in schema) {
                this.on(event, schema[event]);
            }
        }
    }
    
    class WebRTCPeer extends RTCPeerConnection {
        constructor(id, opts) {
            super(opts);
            this.id = id;
            this._remoteIceGatheringState = WebRTC.IceGatheringState.New;
            this._candidatesFlushed = false;
            this._candidates = [];
            this._stream = new MediaStream();
            this._connectedTimes = 0;
            this._channel = {
                public: null,
                private: null
            };
        }
    
        _flushCandidates() {
            if (!this._candidatesFlushed) {
                for (const candidate of this._candidates) {
                    this.addIceCandidate(candidate);
                }
                this._candidatesFlushed = true;
                this._candidates.length = 0;
            }
        }
        
        _hasSender(kind) {
            return this.getSenders().some(sender => {
                return sender.track !== null && sender.track.kind === kind;
            });
        }

        _replaceTrack(track) {
            const oldTrack = this._stream
                .getTracks()
                .find(t => t.kind === track.kind);
            if (oldTrack) this._stream.removeTrack(oldTrack);
            this._stream.addTrack(track);
        }

        get _hasConnectedOnce() {
            return this._connectedTimes > 0;
        }
    }
    
    class WebRTC {
        static Event = { 
            Error: "error",
            Offer: "offer",
            Answer: "answer",
            Candidate: "candidate",
            PeerDisconnected: "peerdisconnected",
            PeerConnected: "peerconnected",
            MediaStream: "mediastream",
            TrackStateChanged: "trackstatechanged",
            Message: "message",
        };
        static IceGatheringState = {
            New: "new",
            Gathering: "gathering",
            Complete: "complete",
        };
        static Track = {
            Audio: "audio",
            Video: "video",
        };
        static SelfId = "self";
    
        constructor() {
            this._peers = {};
            this._track = { audio: null, video: null };
            this._mtx = new Mutex();
            this.event = new WebRTCEventEmitter();
        }

        _emitTrackStateChanged(peerId, kind, enabled) {
            this.event.emit(WebRTC.Event.TrackStateChanged, {
                peerId,
                kind,
                enabled
            });
        }
        _emitError(error) {
            this.event.emit(WebRTC.Event.Error, error);
        }

        _addTrackIfExists(peer, kind) {
            if (this._track[kind] !== null) {
                if (!peer._hasSender(kind)) {
                    peer.addTrack(this._track[kind]);
                }
            }
        }

        _requestUserMedia(kind) {
            return navigator.mediaDevices.getUserMedia({ [kind]: true })
                .catch(() => null);
        }
    
        _createPeer(id) {
            const peer = new WebRTCPeer(id, {
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
                if (peer._connectedTimes > 0) {
                    this.makeOffer(peer.id);
                }
            };
            peer.ontrack = e => {
                peer._replaceTrack(e.track);
                this.event.emit(WebRTC.Event.MediaStream, {
                    peerId: peer.id,
                    stream: peer._stream
                });
            };
            peer.onicecandidate = e => {
                this.event.emit(WebRTC.Event.Candidate, {
                    peerId: peer.id,
                    candidateInfo: {
                        candidate: e.candidate,
                        gatheringState: peer.iceGatheringState
                    }
                });
            };
            peer.onconnectionstatechange = () => {
                if (peer.connectionState === "connected") {
                    if (peer._connectedTimes === 0) {
                        this.event.emit(WebRTC.Event.PeerConnected, {
                            peerId: peer.id
                        });
                    }
                    peer._connectedTimes += 1;
                }
            };
            return peer;
        }
        _getPeer(id) {
            return this._peers[id] ?? null;
        }
        _setPeer(id, peer) {
            this._peers[id] = peer;
        }
        _ensurePeer(id) {
            return this._getPeer(id) ?? this._createPeer(id);
        }
        _forEachPeer(callback) {
            for (const id in this._peers) {
                callback(this._peers[id]);
            }
        }
        _setPeerChannel(peer, channel) {
            channel.onmessage = e => {
                this.event.emit(WebRTC.Event.Message, {
                    peerId: peer.id,
                    data: e.data
                });
            };
            peer._channel.public = channel;
        }

        removePeer(peerId) {
            const peer = this._getPeer(peerId);
            if (peer !== null) {
                delete this._peers[peerId];
                peer.onicecandidate = null;
                peer.onconnectionstatechange = null;
                peer.ontrack = null;
                this.event.emit(WebRTC.Event.PeerDisconnected, { peerId });
            }
        }

        async makeOffer(peerId) {
            const peer = this._ensurePeer(peerId);
            if (peer._channel.public === null) {
                this._setPeerChannel(peer, peer.createDataChannel("public"));
            }
            this._addTrackIfExists(peer, WebRTC.Track.Audio);
            this._addTrackIfExists(peer, WebRTC.Track.Video);
            const offer = await peer.createOffer();
            if (offer.sdp !== undefined) {
                await peer.setLocalDescription(offer);
                this._setPeer(peerId, peer);
                this.event.emit(WebRTC.Event.Offer, {
                    peerId,
                    offer: { sdp: offer.sdp }
                });
            } else {
                this._emitError(new Error("No sdp"));
            }
        }
    
        async acceptOffer(peerId, offer) {
            await this._mtx.lock();
            const peer = this._ensurePeer(peerId);
            if (peer._channel.public === null) {
                peer.ondatachannel = e => {
                    this._setPeerChannel(peer, e.channel);
                };
            }
            this._addTrackIfExists(peer, WebRTC.Track.Audio);
            this._addTrackIfExists(peer, WebRTC.Track.Video);
            const desc = new RTCSessionDescription({ type: "offer", sdp: offer.sdp }); 
            await peer.setRemoteDescription(desc);
            const answer = await peer.createAnswer();
            if (answer.sdp !== undefined) {
                await peer.setLocalDescription(answer);
                if (peer._remoteIceGatheringState === WebRTC.IceGatheringState.Complete) {
                    peer._flushCandidates();
                }
                this._setPeer(peerId, peer);
                this.event.emit(WebRTC.Event.Answer, {
                    peerId,
                    answer: { sdp: answer.sdp }
                });
            } else {
                this._emitError(new Error("No sdp"));
            }
            this._mtx.unlock();
        }
    
        async acceptAnswer(peerId, answer) {
            const peer = this._getPeer(peerId);
            if (peer === null) {
                this._emitError(new Error("No peer"));
                return;
            }
            const desc = new RTCSessionDescription({ type: "answer", sdp: answer.sdp });
            await peer.setRemoteDescription(desc);
            if (peer._remoteIceGatheringState === WebRTC.IceGatheringState.Complete) {
                peer._flushCandidates();
            }
        }
    
        async addCandidate(peerId, candidateInfo) {
            await this._mtx.lock();
            const peer = this._ensurePeer(peerId);
            this._setPeer(peerId, peer);
            peer._remoteIceGatheringState = candidateInfo.gatheringState;
            // If true, candidateInfo.candidate is null so we don't add them
            if (candidateInfo.gatheringState === WebRTC.IceGatheringState.Complete) {
                if (peer.signalingState === "have-remote-offer" ||
                    peer.signalingState === "have-remote-pranswer" ||
                    peer.signalingState === "stable"
                ) {
                    peer._flushCandidates(peer);
                }
            } else {
                peer._candidates.push(candidateInfo.candidate);
            }
            this._mtx.unlock();
        }

        async _setUserMedia(kind, enabled) {
            if (kind !== WebRTC.Track.Audio && kind !== WebRTC.Track.Video) {
                this._emitError(new Error("Invalid track kind"));
                return;
            }
            if (this._track[kind] !== null) {
                this._track[kind].enabled = enabled;
                this._emitTrackStateChanged(WebRTC.SelfId, kind, enabled);
                return;
            }
            if (!enabled) return;

            const stream = await this._requestUserMedia(kind);
            if (stream === null) return;

            const tracks = kind === WebRTC.Track.Audio
                ? stream.getAudioTracks()
                : stream.getVideoTracks();

            const newTrack = tracks.at(0);
            if (newTrack === undefined) {
                this._emitError(new Error("No track"));
                return;
            }

            this._track[kind] = newTrack;
            newTrack.onended = () => {
                this._track[kind] = null;
                this._forEachPeer(peer => {
                    const sender = peer
                        .getSenders()
                        .find(s => s.track?.id === newTrack.id);
                    peer.removeTrack(sender);
                    this._emitTrackStateChanged(WebRTC.SelfId, kind, false);
                });
            }

            this._forEachPeer(peer => peer.addTrack(newTrack));
            this._emitTrackStateChanged(WebRTC.SelfId, kind, true);
        }

        get localAudioEnabled() {
            const track = this._track[WebRTC.Track.Audio];
            return track !== null && track.enabled;
        }
        get localVideoEnabled() {
            const track = this._track[WebRTC.Track.Video];
            return track !== null && track.enabled;
        }
        enableLocalAudio() {
            return this._setUserMedia(WebRTC.Track.Audio, true);
        }
        disableLocalAudio() {
            return this._setUserMedia(WebRTC.Track.Audio, false);
        }
        enableLocalVideo() {
            return this._setUserMedia(WebRTC.Track.Video, true);
        }
        disableLocalVideo() {
            return this._setUserMedia(WebRTC.Track.Video, false);
        }

        send(peerId, data) {
            const peer = this._getPeer(peerId)
            peer?._channel.public.send(data);
        }

        sendToAll(data) {
            this._forEachPeer(peer => peer._channel.public.send(data));
        }
    }

    Object.assign(m, {
        WebRTC,
        WebRTCEventEmitter,
        WebRTCPeer,
        Event: WebRTC.Event,
        Track: WebRTC.Track,
        SelfId: WebRTC.SelfId,
    });
})(WebRTC);


