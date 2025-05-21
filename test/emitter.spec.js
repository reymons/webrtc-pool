import { EventEmitter } from "../src/emitter.js";

describe("event/EventEmitter", () => {
    let emitter;

    beforeEach(() => {
        emitter = new EventEmitter();
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
