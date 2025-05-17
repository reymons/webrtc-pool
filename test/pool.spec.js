import crypto from "crypto";
import { Event } from "../src/dict";
import { types } from "./__utils__";
import { mockWebRTC } from "./mock/webrtc";
import { mockMediaStream } from "./mock/mediaStream";

mockWebRTC();
mockMediaStream();
let { Pool } = await import("../src/pool");

describe("Pool", () => {
    describe("connection flow", () => {
        let pool;
        let peerId;

        beforeEach(() => {
            pool = Pool();
            peerId = crypto.randomUUID().substring(0, 8);
        });

        it("create offer and sends 'offer' event with correct data", done => {
            pool.event.on(Event.Offer, data => {
                expect(data).toStrictEqual({
                    peerId: types.peerId,
                    offer: types.offer
                });
                done();
            });
            pool.makeOffer(peerId);
        });

        it("creates answer and sends 'answer' event with correct data", done => {
            let offerListener = jest.fn(data => {
                pool.acceptOffer(data.peerId, data.offer);
            });
            let answerListener = jest.fn(data => {
                expect(offerListener).toHaveBeenCalledTimes(1);
                expect(data).toStrictEqual({
                    peerId: types.peerId,
                    answer: types.answer,
                });
                done();
            });
            pool.event.on(Event.Offer, offerListener);
            pool.event.on(Event.Answer, answerListener);
            pool.makeOffer(peerId);
        });

        // Really no point in further mock testing here. Switching to e2e :p
    });
});

