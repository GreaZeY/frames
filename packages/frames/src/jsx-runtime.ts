import type { Renderable } from './runtime';

export namespace JSX {
    export type Element = Renderable;
    export type ElementType = string | ((props: never) => Renderable);

    export interface IntrinsicElements {
        [elementName: string]: Record<string, unknown>;
    }

    export interface ElementAttributesProperty {
        props: Record<string, unknown>;
    }

    export interface ElementChildrenAttribute {
        children: Record<string, unknown>;
    }
}

function missingCompiler(): never {
    throw new Error('Frames JSX must be compiled with vite-plugin-frames.');
}

export const jsx = missingCompiler;
export const jsxs = missingCompiler;
export const Fragment = Symbol('Frames.Fragment');
