class MockRTCDataChannel {
    onmessage = null;
}

class MockRTCSessionDescription {
}

class MockRTCPeerConnection {
    onnegotiationneeded = null;
    ontrack = null;
    onicecandidate = null;
    onconnectionstatechange = null;
    ondatachannel = null;

    createDataChannel(label) {
        return new MockRTCDataChannel(label);
    }

    addTrack() {}

    getSenders() {
        return [];
    }

    createOffer() {
        return Promise.resolve({ type: "offer", sdp: "123" });
    }

    createAnswer() {
        return Promise.resolve({ type: "answer", sdp: "123" });
    }

    addIceCandidate() {}

    async setLocalDescription() {}

    async setRemoteDescription() {}

    addTransceiver() {}

    getTransceivers() {
        return [];
    }
}

export function mockWebRTC() {
    window.RTCDataChannel = MockRTCDataChannel;
    window.RTCPeerConnection = MockRTCPeerConnection;
    window.RTCSessionDescription = MockRTCSessionDescription;
}

