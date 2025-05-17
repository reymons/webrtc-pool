import crypto from "crypto";

class Connection {
    static getId() {
        return crypto.randomUUID().substring(0, 8);
    }

    constructor(socket, req) {
        this.id = Connection.getId();
        this.socket = socket;
        this.req = req;
    }

    send(type, data) {
        this.socket.send(JSON.stringify({ type, data }));
    }

    sendError(message) {
        this.send("error", message);
    }
}

class Room {
    #conns = new Map();

    addConnection(conn) {
        this.#conns.set(conn.id, conn);
        // it's okay for a dev server
        let peerIds = [...this.#conns.keys()].filter(id => id !== conn.id);
        conn.send("init", { peerIds });
    }

    deleteConnection(id) {
        this.#conns.delete(id);
        for (let conn of this.#conns.values()) {
            conn.send("disconnect", { peerId: id });
        }
    }

    sendErrorTo(connId, message) {
        let conn = this.#conns.get(connId);
        conn?.sendError(message);
    }

    sendOfferTo(connId, fromConnId, offer) {
        let conn = this.#conns.get(connId);
        if (conn === undefined) {
            this.sendErrorTo(fromConnId, "No peer with such an id");
        } else {
            conn.send("offer", { peerId: fromConnId, offer });
        }
    }

    sendAnswerTo(connId, fromConnId, answer) {
        let conn = this.#conns.get(connId);
        if (conn === undefined) {
            this.sendErrorTo(fromConnId, "No peer with such an id");
        } else {
            conn.send("answer", { peerId: fromConnId, answer });
        }
    }
 
    sendCandidateTo(connId, fromConnId, candidateInfo) {
        let conn = this.#conns.get(connId);
        if (conn === undefined) {
            this.sendErrorTo(fromConnId, "No peer with such an id");
        } else {
            conn.send("candidate", { peerId: fromConnId, candidateInfo });
        }
    }
}

function onMessage(messageData, ctx) {
    let { room, conn } = ctx;
    let { type, data } = JSON.parse(messageData);

    switch (type) {
        case "offer":
            room.sendOfferTo(data.peerId, conn.id, data.offer);
            break;
        case "answer":
            room.sendAnswerTo(data.peerId, conn.id, data.answer);
            break;
        case "candidate":
            room.sendCandidateTo(data.peerId, conn.id, data.candidateInfo);
            break;
        default:
            conn.sendError("Invalid type");
            break;
    }
}

export function runSignalingServer(fastify) {
    let room = new Room();

    fastify.register(import("@fastify/websocket"));
    
    fastify.register(instance => {
        instance.get("/rtc", { websocket: true }, (socket, req) => {
            let conn = new Connection(socket, req);
            let ctx = { conn, room };
            room.addConnection(conn);
            socket.on("message", data => onMessage(data, ctx));
            socket.on("close", () => room.deleteConnection(conn.id));
        });
    });
}
