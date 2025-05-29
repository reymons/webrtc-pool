# WebRTC Pool
Simple library for managing a pool of webrtc peer connections<br>
This library is NOT production-ready yet and lacks some important features like, for example, messaging

## Peer pool
Here's a simple video conference app. Receive remote media streams, manage peer life cycle, toggle your microphone and camera.
```js
const roomId = "some-id";
const pool = new WebRTCPool();
const signaler = new Signaler(roomId); // Your implementation

/*
    Map signaling server events to pool methods and pool events to signaling server methods
    Basic session description exchange flow as follows:
    
    Signaler sends "session" -> pool.makeOffer()   -> pool sends "offer"  -> Signaler.sendOffer()  ->
    Signaler sends "offer"   -> pool.acceptOffer() -> pool sends "answer" -> Signaler.sendAnswer() ->
    Signaler sends "answer"  -> pool.acceptAnswer()
    
    Meanwhile in the background there's going to be an ICE candidates exchange in the following manner:
    pool sends "candidate" -> Signaler.sendCandidate() -> Signaler sends "candidate" -> pool.addCandidate()
*/

signaler.on("init", data => {
    data.userIds.forEach(id => pool.makeOffer(id));
});
signaler.on("offer", data => pool.acceptOffer(data.offer, data.senderId));
signaler.on("answer", data => pool.acceptAnswer(data.answer, data.senderId));
signaler.on("candidate", data => pool.addCandidate(data.candidate, data.senderId));
signaler.on("disconnect", data => pool.closePeer(data.userId));

pool.on("offer", data => signaler.send("offer", data.offer, data.peerId));
pool.on("answer", data => signaler.send("answer", data.answer, data.peerId));
pool.on("candidate", data => signaler.send("candidate", data.candidate, data.peerId));

// Manage peer life cycle, streams, track states, etc...

pool.on("connection", peer => {
    let doc = document.getElementById("visitor-templ").content.cloneNode(true);
    let root = doc.firstElementChild;
    let video = doc.querySelector("video");
    let micBtn = doc.querySelector(".mic");
    let camBtn = doc.querySelector(".cam");

    video.srcObject = peer.remoteStream;
    document.body.appendChild(rootEl);

    peer.on("disconnect", () => root.remove());

    peer.on("remotemediachange", () => {
        micBtn.style.color = peer.remoteAudioEnabled ? "green" : "red";
        camBtn.style.color = peer.remoteVideoEnabled ? "green" : "red";
    });

    requestAnimationFrame(() => video.play());
});

// Manipulate local streams
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
micBtn.onclick = () => pool.toggleLocalAudio();
camBtn.onclick = () => pool.toggleLocalVideo();
```

## Links
- https://hpbn.co/webrtc
- https://sookocheff.com/post/networking/how-does-web-rtc-work

