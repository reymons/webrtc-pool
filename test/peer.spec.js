import { parseChannelMessage } from "../src/peer.js";
import { ChannelEvent } from "../src/dict.js";
import { is } from "../src/utils.js";

describe("Peer / parseChannelMessage()", () => {
    it("parses correctly", () => {
        let message = {
            type: ChannelEvent.UserMessage,
            data: { age: 21 }
        };
        let parsedMessage = parseChannelMessage(JSON.stringify(message));
        expect(parsedMessage).toStrictEqual(message);
    });

    it.each([
        null, undefined, {}, [], 1, false,
        Symbol(), BigInt(0), "123", () => {},
    ])("handles incorret message", (value) => {
        let result = parseChannelMessage(value);
        expect(result).toBeNull();
        
        if (is.obj(value) || typeof value === "bigint") return;
        result = parseChannelMessage(JSON.stringify({
            type: ChannelEvent.UserMessage,
            data: value
        }));
        expect(result).toBeNull();
    });
});
