class MockMediaStream {
    getTracks() {
        return [];
    }
}

export function mockMediaStream() {
    window.MediaStream = MockMediaStream;
}
