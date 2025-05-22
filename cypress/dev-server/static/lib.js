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

    sendOffer(offer, peerId) {
        this._send("offer", { offer, peerId });
    }

    sendAnswer(answer, peerId) {
        this._send("answer", { answer, peerId });
    }

    sendCandidate(candidate, peerId) {
        this._send("candidate", { candidate, peerId });
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
        this.pool = new Pool();
        this._removePoolListeners = null;
    }

    _onSigServerMessage(message) {
        let { type, data } = message;

        switch (type) {
            case "init":
                data.peerIds.forEach(id => this.pool.makeOffer(id));
                break;
            case "offer":
                this.pool.acceptOffer(data.offer, data.peerId);
                break;
            case "answer":
                this.pool.acceptAnswer(data.answer, data.peerId);
                break;
            case "candidate":
                this.pool.addCandidate(data.candidate, data.peerId);
                break;
            case "disconnect":
                this.pool.closePeer(data.peerId);
                break;
        }
    }

    enter() {
        let removeListenerFns = [
            this.pool.on("offer", ({ offer, peerId }) => {
                this._sigServer.sendOffer(offer, peerId);
            }),
            this.pool.on("answer", ({ answer, peerId }) => {
                this._sigServer.sendAnswer(answer, peerId);
            }),
            this.pool.on("candidate", ({ candidate, peerId }) => {
                this._sigServer.sendCandidate(candidate, peerId);
            }),
            this.pool.on("error", error => console.error(error))
        ];

        this._removePoolListeners = () => {
            removeListenerFns.forEach(fn => fn());
        };

        this._sigServer.onMessage = data => {
            this._onSigServerMessage(data);
        };

        this._sigServer.start();
    }

    exit() {
        this._sigServer.stop();
        this._removePoolListeners?.();
        this.pool.closeAllPeers();
    }
}

class GuestView {
    constructor(peer) {
        this._peer = peer;
    }

    render(root) {
        let temp = document.querySelector("template#guest");
        let doc = temp.content.cloneNode(true);
        let peer = this._peer;
    
        this._video = doc.querySelector("video");
        this._video.srcObject = peer.remoteStream;
        this._node = doc.firstElementChild;

        doc.getElementById("btn-remote-audio").onclick = () => {
            peer.toggleRemoteAudio();
        };
        doc.getElementById("btn-remote-video").onclick = () => {
            peer.toggleRemoteVideo();
        };

        let micStatus = doc.getElementById("status-mic");
        let camStatus = doc.getElementById("status-cam");
        peer.on("remotemediachange", () => {
            micStatus.innerText = peer.remoteAudioEnabled ? "Mic on" : "Mic off";
            camStatus.innerText = peer.remoteVideoEnabled ? "Cam on" : "Cam off";
        });

        root.appendChild(doc);

        requestAnimationFrame(() => {
            this._video.play().catch(console.error);
        });
    }

    remove() {
        this._node.remove();
    }
}

export class RoomView {
    constructor(room) {
        this._room = room;
        this._connected = false;
    }

    render() {
        let templ = document.querySelector("template#room");
        let doc = templ.content.cloneNode(true);
        let node = doc.firstElementChild;
        let btnMic = doc.getElementById("btn-mic");
        let btnCam = doc.getElementById("btn-cam");
        let btnConnect = doc.getElementById("btn-connect");
        let pool = this._room.pool;
        
        btnMic.onclick = () => pool.toggleLocalAudio();
        btnCam.onclick = () => pool.toggleLocalVideo();
        btnConnect.onclick = () => {
            let connected = this._connected;
            if (connected) {
                this._room.exit();
                pool.toggleLocalAudio(false);
                pool.toggleLocalVideo(false);
            }
            else this._room.enter();
            connected = !connected;
            btnMic.disabled = !connected;
            btnCam.disabled = !connected;
            btnConnect.textContent = connected ? "Diconnect" : "Connect";
            this._connected = connected;
        };

        pool.on("connection", (peer) => {
            let guestView = new GuestView(peer);
            guestView.render(node.querySelector("#guests"));

            peer.on("disconnect", () => {
                guestView.remove();
            });
        });

        node.setAttribute("id", this._room.id);
        document.body.appendChild(doc);
    }
}

