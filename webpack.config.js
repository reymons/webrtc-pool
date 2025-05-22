import path from "path";
import CopyPlugin from "copy-webpack-plugin";

const dirname = import.meta.dirname;
const srcDir = path.join(dirname, "src");

const configs = [
    {
        output: {
            filename: "lib.win.js",
            library: {
                type: "window",
                name: "WebRTCPool"
            }
        }
    },
    {
        output: {
            filename: "lib.esm.js",
            library: {
                type: "module",
            },
            module: true,
        },
        experiments: {
            outputModule: true,
        },
    },
    {
        output: {
            filename: "lib.common.js",
            library: {
                type: "commonjs",
            }
        }
    }
];

export default configs.map(config => ({
    entry: path.join(srcDir, "index.js"),
    mode: "production",
    ...config,
    output: {
        path: path.join(dirname, "build"),
        ...config["output"],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "package.json" },
                { from: "types", to: "types" }
            ]
        })
    ]
}));
