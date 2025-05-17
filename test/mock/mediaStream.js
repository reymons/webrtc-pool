class MockMediaStream {
}

export function mockMediaStream() {
    window.MediaStream = MockMediaStream;
}
