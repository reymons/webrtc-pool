//"use strict"

import fs from "fs";
import path from "path";
import Fastify from "fastify";
import { runSignalingServer } from "./signaling-server.js"

let dirname = import.meta.dirname;

let fastify = Fastify({
    https: {
        key: fs.readFileSync(path.join(dirname, "key.pem")),
        cert: fs.readFileSync(path.join(dirname, "cert.pem")),
    }
});

fastify.register(import("@fastify/static"), {
    root: path.join(dirname, "static"),
    prefix: "/static",
});
fastify.register(import("@fastify/static"), {
    root: path.join(dirname, "..", "src"),
    prefix: "/lib",
    decorateReply: false,
});

fastify.get("/", (_, rep) => {
    rep.sendFile("index.html");
});

runSignalingServer(fastify);

fastify.listen({
    host: "0.0.0.0",
    port: 5454
}, (err, addr) => {
    if (err) throw new Error(err);
    console.log(`Dev server is running on ${addr}`);
});
