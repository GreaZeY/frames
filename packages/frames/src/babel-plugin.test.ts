import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import framesBabelPlugin from './babel-plugin';

function compile(code: string) {
    const result = transformSync(code, {
        plugins: [
            '@babel/plugin-syntax-jsx',
            framesBabelPlugin
        ],
        ast: false,
        code: true
    });
    return result?.code;
}

describe('frames babel plugin', () => {
    it('compiles a simple div', () => {
        const out = compile('const a = <div />;');
        expect(out).toContain('document.createElement("div")');
    });

    it('compiles attributes', () => {
        const out = compile('const a = <div id="test" data-custom="yes" />;');
        expect(out).toContain('.id = "test"'); // Direct prop assignment
        expect(out).toContain('.setAttribute("data-custom", "yes")'); // Fallback for unknown
    });

    it('compiles dynamic properties', () => {
        const out = compile('const a = <input value={val} />;');
        expect(out).toContain('effect(() => _el.value = val)');
    });

    it('compiles event listeners', () => {
        const out = compile('const a = <button onClick={() => {}} />;');
        expect(out).toContain('.$$click = ');
        expect(out).toContain('_delegateEvent("click")');
    });

    it('compiles text children', () => {
        const out = compile('const a = <div>Hello World</div>;');
        expect(out).toContain('.createTextNode("Hello World")');
        expect(out).toContain('.appendChild(');
    });

    it('compiles dynamic text children', () => {
        const out = compile('const a = <div>{count.value}</div>;');
        expect(out).toContain('insert(_el, () => count.value)');
    });

    it('compiles nested elements', () => {
        const out = compile('const a = <div><span>Nested</span></div>;');
        // Basic check that both tags are created and nested
        expect(out).toContain('document.createElement("div")');
        expect(out).toContain('document.createElement("span")');
        expect(out).toContain('insert(_el, ');
    });
});
