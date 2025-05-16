import { Event } from "./dict";

function EventEmitter() {
    let eventHash = crypto.randomUUID().substring(0, 8);
    let eventName = type => `__${eventHash}_${type}`;

    let on = (type, listener) => {
        let event = eventName(type);
        let handler = e => listener(e.detail);
        window.addEventListener(event, handler);
        return () => window.removeEventListener(event, handler);
    }

    let emit = (type, detail) => {
        let ev = new CustomEvent(eventName(type), { detail });
        window.dispatchEvent(ev);
    }

    let map = (schema) => {
        for (let event in schema) {
            on(event, schema[event]);
        }
    }

    return { on, emit, map };
}

export default function EventSender() {
    let event = EventEmitter();
    
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
