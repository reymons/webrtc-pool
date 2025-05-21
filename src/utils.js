let t = val => typeof val;

export let is = {
    obj: v => t(v) === "object" && v !== null,
}

export let validate = {
    peerId: v => t(v) === "string" || t(v) === "number" || t(v) === "bigint",
};

export function requestUserMediaStream(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints)
        .catch(() => null);
}
