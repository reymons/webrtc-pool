import { SignalingServer, Room, RoomView } from "./lib.js";

function createRoomView(roomId) {
    let url = `wss://${location.host}/rtc`;
    let sigServer = new SignalingServer(url);
    let room = new Room(roomId, sigServer);
    return new RoomView(room);
}

createRoomView("room-1").render();
createRoomView("room-2").render();
createRoomView("room-3").render();
