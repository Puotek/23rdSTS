import { defineConfig } from "astro/config";

export default defineConfig({
    site: "https://puotek.github.io",
    base: "/23rdSTS",
    vite: {
        server: {
            allowedHosts: [".trycloudflare.com"],
        },
    },
//   cloudflared tunnel --url http://localhost:4321
});
