import { transformSync } from '@babel/core';
import framesBabelPlugin from 'frames/babel-plugin';
import type { Plugin } from 'vite';

interface FramesPluginOptions {
    include?: RegExp;
}

export default function framesPlugin(options: FramesPluginOptions = {}): Plugin {
    const include = options.include ?? /\.[jt]sx$/;

    return {
        name: 'vite-plugin-frames',
        enforce: 'pre',
        transform(code: string, id: string) {
            if (include.test(id.split('?')[0])) {
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
                    map: result?.map ? JSON.stringify(result.map) : null
                };
            }
        }
    };
}
