import { Pool } from "./pool.js";

export { Pool as WebRTCPool };
export { EventEmitter } from "./emitter.js";
export {
    MediaKind,
    PeerEvent,
    PoolEvent,
} from "./dict.js";

export function createPool(...args) {
    return new Pool(...args);
}

