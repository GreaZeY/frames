import { transformSync } from '@babel/core';
import framesBabelPlugin from 'frames/src/babel-plugin.ts';
import type { Plugin } from 'vite';

export default function framesPlugin(): Plugin {
    return {
        name: 'vite-plugin-frames',
        enforce: 'pre',
        transform(code: string, id: string) {
            if (id.endsWith('.tsx') || id.endsWith('.jsx')) {
                const result = transformSync(code, {
                    filename: id,
                    presets: [
                        '@babel/preset-typescript'
                    ],
                    plugins: [
                        '@babel/plugin-syntax-jsx',
                        framesBabelPlugin
                    ],
                    ast: false,
                    sourceMaps: true
                });
                return {
                    code: result?.code || code,
                    map: result?.map
                };
            }
        }
    };
}
