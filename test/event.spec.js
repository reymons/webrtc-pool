import { EventEmitter, EventSender } from "../src/event";
import { Event } from "../src/dict";
import crypto from "crypto";

describe("event/EventEmitter", () => {
    let emitter;

    beforeEach(() => {
        emitter = EventEmitter();
    });

    it("emits event with correct data", () => {
        let event = "bla-bla";
        let data = { a: 1, b: "2", c: [1, 2] };
        let handler = eventData => {
            expect(eventData).toStrictEqual(data);
        }
        let off = emitter.on(event, handler);
        emitter.emit(event, data);
        off();
    });

    it("calls multiple listeners of same event", () => {
        let event = "ddd";
        let handlers = [];
        for (let i = 0; i < 5; i++) {
            let handler = jest.fn();
            emitter.on(event, handler);
            handlers.push(handler);
        }
        emitter.emit(event, null);
        handlers.forEach(h => expect(h).toHaveBeenCalledTimes(1));
    });

    it("emits same data for listeners of same event", () => {
        let event = "bbb";
        let data = [1, 2, 3];
        for (let i = 0; i < 5; i++) {
            emitter.on(event, eventData => {
                expect(eventData).toStrictEqual(data);
            });
        }
        emitter.emit(event, data);
    });

    it("removes listener when calling off() returned by on()", () => {
        let event = "bbb";
        let handler = jest.fn();
        let off = emitter.on(event, handler); 
        off();
        emitter.emit(event, null);
        expect(handler).toHaveBeenCalledTimes(0);
    });

    it("removes listener when calling off() directly", () => {
        let event = "bbb";
        let handler = jest.fn();
        emitter.on(event, handler); 
        emitter.off(event, handler);
        emitter.emit(event, { a: 1 });
        expect(handler).toHaveBeenCalledTimes(0);
    });

    it("calls each mapped listener with correct data", () => {
        let fn1 = jest.fn(), ev1 = "aaa", data1 = [1, 2, 3];
        let fn2 = jest.fn(), ev2 = "bbb", data2 = { a: 1, b: 2, c: 3 };
        emitter.map({ [ev1]: fn1, [ev2]: fn2 });
        emitter.emit(ev1, data1);
        emitter.emit(ev2, data2);
        expect(fn1).toHaveBeenCalledTimes(1);
        expect(fn1).toHaveBeenCalledWith(data1);
        expect(fn2).toHaveBeenCalledTimes(1);
        expect(fn2).toHaveBeenCalledWith(data2);
    });

    it("removes listeners when calling off() returned by map()", () => {
        let fn1 = jest.fn(), ev1 = "aaa";
        let fn2 = jest.fn(), ev2 = "bbb";
        let off = emitter.map({ [ev1]: fn1, [ev2]: fn2 });
        off();
        emitter.emit(ev1, null);
        emitter.emit(ev2, null);
        expect(fn1).toHaveBeenCalledTimes(0);
        expect(fn2).toHaveBeenCalledTimes(0);
    });

    it("allows to call off() multiple times of the same on() call", () => {
        let off = emitter.on("abc", () => {});
        off();
        off();
        off();
        off();
    });

    it("allows to call off() multiple times on the same event", () => {
        let listener = () => {};
        let event = "abc";
        emitter.on(event, listener);
        emitter.off(event, listener);
        emitter.off(event, listener);
        emitter.off(event, listener);
        emitter.off(event, listener);
    });
});

describe("event/EventSender", () => {
    let sender = EventSender();

    let forEachEvent = (cb) => {
        let peerId = crypto.randomUUID().substring(0, 8);

        for (let event of Object.values(Event)) {
            cb(event, peerId, Event[event]);
        }
    };

    forEachEvent((event, peerId, data) => {
        it(`emits ${event} event with correct data only once`, () => {
            let listener = jest.fn();
            sender.event.on(event, listener);
            if (event === Event.Error) {
                sender[event](data);
                expect(listener).toHaveBeenCalledTimes(1);
                expect(listener).toHaveBeenCalledWith(data);
            } else {
                sender[event](peerId, data);
                expect(listener).toHaveBeenCalledTimes(1);
                expect(listener).toHaveBeenCalledWith({ peerId, data });
            }
        });
    });
});
