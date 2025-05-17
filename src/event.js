import { Event } from "./dict";

export function EventEmitter() {
    let listeners = {};

    let on = (event, listener) => {
        let set = listeners[event] ?? new Set();
        set.add(listener);
        listeners[event] = set;
    }

    let onWithOff = (event, listener) => {
        on(event, listener);
        return () => off(event, listener);
    };

    let off = (event, listener) => {
        let set = listeners[event];
        if (set !== undefined) {
            set.delete(listener);
            if (set.size === 0) {
                delete listeners[event];
            }
        }
    };

    let emit = (event, data) => {
        let set = listeners[event];
        set?.forEach(listener => listener(data));
    }

    let map = (schema) => {
        for (let event in schema) {
            on(event, schema[event]);
        }
        return () => {
            for (let event in schema) {
                off(event, schema[event]);
            }
        };
    }

    return { on: onWithOff, off, map, emit };
}

export function EventSender() {
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
        peerconnected(peerId) {
            event.emit(Event.PeerConnected, body(peerId, {}));
        },
        peerdisconnected(peerId) {
            event.emit(Event.PeerDisconnected, body(peerId, {}));
        },
        message(peerId, data) {
            event.emit(Event.Message, body(peerId, { data }));
        },
        trackstatechanged(peerId, kind, enabled) {
            event.emit(Event.TrackStateChanged, body(peerId, { kind, enabled }));
        },
        mediastream(peerId, stream) {
            event.emit(Event.MediaStream, body(peerId, { stream }));
        },
    }
}
