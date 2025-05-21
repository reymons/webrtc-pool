import { sEventData } from "./dict.js";

export class EventEmitter {
    constructor() {
        this[sEventData] = {};
    }

    on(event, listener) {
        let listeners = this[sEventData][event] ?? new Set();
        listeners.add(listener);
        this[sEventData][event] = listeners;
        return () => this.off(event, listener);
    }

    off(event, listener) {
        let listeners = this[sEventData][event];
        if (listeners !== undefined) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                delete this[sEventData][event];
            }
        }
    }
    
    emit(event, data) {
        let listeners = this[sEventData][event];
        listeners?.forEach(listener => listener(data));
    }
}

