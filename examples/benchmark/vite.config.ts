import { defineConfig } from 'vite';

export default defineConfig({
    server: { port: 3001 },
    resolve: {
        alias: {
            'react': 'react',
            'react-dom': 'react-dom'
        }
    }
});
