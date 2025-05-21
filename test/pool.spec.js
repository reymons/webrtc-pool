import crypto from "crypto";
import { PoolEvent } from "../src/dict.js";
import { types } from "./__utils__.js";
import { mockWebRTC } from "./mock/webrtc.js";
import { mockMediaStream } from "./mock/mediaStream.js";

mockWebRTC();
mockMediaStream();
let { Pool } = await import("../src/pool.js");

describe("Pool", () => {
    describe("connection flow", () => {
        let pool;
        let peerId;

        beforeEach(() => {
            pool = new Pool();
            pool.on(PoolEvent.Error, error => {
                throw error;
            });
            peerId = crypto.randomUUID().substring(0, 8);
        });

        it("create offer and sends 'offer' event with correct data", done => {
            pool.on(PoolEvent.Offer, data => {
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
                pool.acceptOffer(data.offer, data.peerId);
            });
            let answerListener = jest.fn(data => {
                expect(offerListener).toHaveBeenCalledTimes(1);
                expect(data).toStrictEqual({
                    peerId: types.peerId,
                    answer: types.answer,
                });
                done();
            });
            pool.on(PoolEvent.Offer, offerListener);
            pool.on(PoolEvent.Answer, answerListener);
            pool.makeOffer(peerId);
        });
    });
});

