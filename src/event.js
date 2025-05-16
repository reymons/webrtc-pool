class EventEmitter {
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

export default function createEventSender() {
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
