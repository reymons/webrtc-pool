let t = val => typeof val;

export let is = {
    obj: v => t(v) === "object" && v !== null,
    promise: v => is.obj(v) && t(v.then) === "function",
}

export let validate = {
    peerId: v => t(v) === "string" || t(v) === "number" || t(v) === "bigint",
    offer: v => is.obj(v) && t(v.sdp) === "string",
    answer: v => is.obj(v) && t(v.sdp) === "string",
    candidateInfo: v => is.obj(v) && is.obj(v.candidate) && t(v.gatheringState) === "string",
};

