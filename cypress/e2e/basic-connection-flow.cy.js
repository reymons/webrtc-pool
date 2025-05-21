describe("basic connection flow", () => {
    let room1;
    let room2;

    beforeEach(() => {
        room1 = getRoom(1);
        room2 = getRoom(2);
    });

    let expectStreamToHaveTrack = (kind, stream) => {
        expect(stream).to.exist;
        let track;
        if (kind === "audio") {
            track = stream.getAudioTracks()[0];
        } else if (kind === "video") {
            track = stream.getVideoTracks()[0];
        } else {
            throw new Error("Invalid kind. Should be either audio or video");
        }
        expect(track).to.exist;
    };

    let waitForNegotiation = () => cy.wait(500);

    let r = (num) => cy.get(`#room-${num}`);

    let getRoom = (n) => ({
        cy: () => r(n),
        connect: () => r(n).find("#btn-connect").click(),
        microphone: () => r(n).find("#btn-mic").click(),
        camera: () => r(n).find("#btn-cam").click(),
        video: {
            hasTracks: (kinds) => {
                r(n).find("video").then(video => {
                    for (let kind of kinds) {
                        expectStreamToHaveTrack(kind, video[0].srcObject);
                    }
                });
            },
            stream: {
                get: () => new Promise(resolve => {
                    r(n).find("video").then(video => {
                        resolve(video[0].srcObject);
                    });
                }),
                track: (kind) => new Promise((resolve, reject) => {
                    r(n).find("video").then(video => {
                        for (let track of video[0].srcObject.getTracks()) {
                            if (track.kind === kind) {
                                resolve(track)
                                return;
                            }
                        }
                        reject(new Error(`No track with kind ${kind}`));
                    });
                }),
            }
        }
    });

    let connect = (rooms) => {
        cy.visit("https://localhost:5454");
        rooms.forEach(room => room.connect());
        waitForNegotiation();
    };

    it("establishes a connection between two peers", () => {
        connect([room1, room2]);
        room1.cy().find(".guests").children().should("have.length", 1);
        room2.cy().find(".guests").children().should("have.length", 1);
    });

    it("streams video to another peer", () => {
        connect([room1, room2]);
        room1.camera(true);
        waitForNegotiation();
        room2.video.hasTracks(["video"]);
    });

    // TODO: figure out why it passes with 'open' but not with 'run' command
    //it("streams audio to another peer", () => {
    //    connect([room1, room2]);
    //    room1.microphone(true);
    //    waitForNegotiation();
    //    room2.video.hasTracks(["audio"]);
    //});

    it("can exchange video and audio streams simultaniously", () => {
        connect([room1, room2]);
        room1.camera(true);
        room1.microphone(true);
        waitForNegotiation();
        room2.video.hasTracks(["video", "audio"]);
    });

    it("both peers can exchange video streams simultaniously", () => {
        connect([room1, room2]);
        room1.camera(true);
        room2.camera(true);
        waitForNegotiation();
        room1.video.hasTracks(["video"]);
        room2.video.hasTracks(["video"]);
    });

    it("both peers can exchange audio streams simultaniously", () => {
        connect([room1, room2]);
        room1.microphone(true);
        room2.microphone(true);
        waitForNegotiation();
        room1.video.hasTracks(["audio"]);
        room2.video.hasTracks(["audio"]);
    });

    it("both peers exchange audio and video streams simultaniously", () => {
        connect([room1, room2]);
        room1.camera(true);
        room1.microphone(true);
        room2.camera(true);
        room2.microphone(true);
        waitForNegotiation();
        room1.video.hasTracks(["audio", "video"]);
        room2.video.hasTracks(["audio", "video"]);
    });

    it("sets stream object only once", async () => {
        connect([room1, room2]);
        room1.camera(true);
        waitForNegotiation();
        let oldStream = await room2.video.stream.get();
        room1.camera(false);
        waitForNegotiation();
        let newStream = await room2.video.stream.get();
        expect(oldStream).to.equal(newStream);
    });

    it("can see peer's video if it was enabled beforehand", () => {
        connect([room1]);
        room1.camera(true);
        room2.connect();
        waitForNegotiation();
        room2.video.hasTracks(["video"]);
    });

    it("can hear peer's audio if it was enabled beforehand", () => {
        connect([room1]);
        room1.microphone(true);
        room2.connect();
        waitForNegotiation();
        room2.video.hasTracks(["audio"]);
    });

    it("can hear and see peer's audio and video if they were enabled beforehand", () => {
        connect([room1]);
        room1.microphone(true);
        room1.camera(true);
        room2.connect();
        waitForNegotiation();
        room2.video.hasTracks(["audio", "video"]);
    });

    // TODO: it("toggles video correctly");
    // TODO: it("toggles audio correctly");
});
