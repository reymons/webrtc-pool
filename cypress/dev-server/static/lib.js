import { Event } from "/lib/dict.js";
import { Pool } from "/lib/pool.js";

export class SignalingServer {
    constructor(url) {
        this._socket = null;
        this._url = url;
        this._onMessage = null;

    }

    set onMessage(value) {
        if (typeof value !== "function") {
            throw new Error("onMessage value should be a function");
        }
        this._onMessage = value;
    }

    _send(type, data) {
        this._socket.send(JSON.stringify({ type, data }));
    }

    sendOffer(peerId, offer) {
        this._send("offer", { peerId, offer });
    }

    sendAnswer(peerId, answer) {
        this._send("answer", { peerId, answer });
    }

    sendCandidateInfo(peerId, candidateInfo) {
        this._send("candidate", { peerId, candidateInfo });
    }

    start() {
        let socket = new WebSocket(this._url);
        socket.onmessage = e => {
            this._onMessage?.(JSON.parse(e.data));
        };
        this._socket = socket;
    }

    stop() {
        this._socket?.close();
        this._socket = null;
    }
}

export class Room {
    constructor(id, sigServer) {
        this.id = id;
        this._sigServer = sigServer;
        this.pool = Pool();
        this._peers = new Set();
        this._removePoolListener = null;
    }

    _onSigServerMessage(message) {
        let { type, data } = message;

        switch (type) {
            case "init":
                data.peerIds.forEach(id => this.pool.makeOffer(id));
                break;
            case "offer":
                this.pool.acceptOffer(data.peerId, data.offer);
                break;
            case "answer":
                this.pool.acceptAnswer(data.peerId, data.answer);
                break;
            case "candidate":
                this.pool.addCandidate(data.peerId, data.candidateInfo);
                break;
            case "disconnect":
                this.pool.removePeer(data.peerId);
                break;
        }
    }

    enter() {
        this._removePoolListener = this.pool.event.map({
            [Event.Offer]: ({ peerId, offer }) => {
                this._sigServer.sendOffer(peerId, offer);
            },
            [Event.Answer]: ({ peerId, answer }) => {
                this._sigServer.sendAnswer(peerId, answer);
            },
            [Event.Candidate]: ({ peerId, candidateInfo }) => {
                this._sigServer.sendCandidateInfo(peerId, candidateInfo);
            },
        });

        this._sigServer.onMessage = data => this._onSigServerMessage(data);
        this._sigServer.start();
    }

    exit() {
        this._sigServer.stop();
        this._removePoolListener?.();
        this.pool.removeAllPeers();
    }
}

class GuestView {
    render(root) {
        let temp = document.querySelector("template#guest");
        let doc = temp.content.cloneNode(true);
        this._video = doc.querySelector("video");
        this._node = doc.firstElementChild;
        root.appendChild(doc);
    }

    attachStream(s) {
        this._video.srcObject = s;
        this._video.play();
    }

    remove() {
        this._node.remove();
    }
}

export class RoomView {
    constructor(room) {
        this._room = room;
        this._connected = false;
        this._guests = new Map();
    }

    render() {
        let templ = document.querySelector("template#room");
        let doc = templ.content.cloneNode(true);
        let node = doc.firstElementChild;
        let btnMic = doc.getElementById("btn-mic");
        let btnCam = doc.getElementById("btn-cam");
        let btnConnect = doc.getElementById("btn-connect");
        let { pool } = this._room;
        
        btnMic.onclick = () => {
            if (pool.localAudioEnabled) {
                pool.disableLocalAudio();
            } else {
                pool.enableLocalAudio();
            }
        };
        btnCam.onclick = () => {
            let { pool } = this._room;
            if (pool.localVideoEnabled) {
                pool.disableLocalVideo();
            } else {
                pool.enableLocalVideo();
            }
        };
        btnConnect.onclick = () => {
            let connected = this._connected;
            if (connected) this._room.exit();
            else this._room.enter();
            connected = !connected;
            btnMic.disabled = !connected;
            btnCam.disabled = !connected;
            btnConnect.textContent = connected ? "Diconnect" : "Connect";
            this._connected = connected;
        };

        pool.event.map({
            [Event.PeerConnected]: ({ peerId }) => {
                let guestView = new GuestView();
                guestView.render(node.querySelector("#guests"));
                this._guests.set(peerId, guestView);
            },
            [Event.PeerDisconnected]: ({ peerId }) => {
                let guestView = this._guests.get(peerId);
                guestView.remove();
                this._guests.delete(peerId);
            },
            [Event.MediaStream]: ({ peerId, stream }) => {
                let guestView = this._guests.get(peerId);
                guestView?.attachStream(stream);
            },
        });

        node.setAttribute("id", this._room.id);
        document.body.appendChild(doc);
    }
}

