import { defineConfig } from 'vite';
import framesPlugin from 'vite-plugin-frames';

export default defineConfig({
    plugins: [framesPlugin()],
    server: {
        port: 3000
    }
});
