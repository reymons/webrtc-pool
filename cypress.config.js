import { defineConfig } from "cypress"

export default defineConfig({
    e2e: {
        baseUrl: "http://localhost:5454",
        supportFile: false,
        viewportWidth: 1440,
        viewportHeight: 900,
    },
});
