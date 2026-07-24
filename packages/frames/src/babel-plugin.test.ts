/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import framesBabelPlugin from './babel-plugin';
import * as runtime from './index';

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

function execute(expression: string, values: Record<string, unknown> = {}): any {
    const output = compile(`globalThis.__framesResult = ${expression};`)!;
    const executable = output.replace(
        /import\s+\{([^}]+)\}\s+from\s+["']frames["'];?/g,
        (_match, imports: string) => {
            const bindings = imports.split(',').map(part => {
                const [name, alias] = part.trim().split(/\s+as\s+/);
                return alias ? `${name}: ${alias}` : name;
            });
            return `const { ${bindings.join(', ')} } = runtime;`;
        }
    );
    const names = Object.keys(values);
    new Function('runtime', ...names, executable)(runtime, ...Object.values(values));
    return (globalThis as any).__framesResult;
}

describe('frames babel plugin', () => {
    it('compiles a simple div', () => {
        const out = compile('const a = <div />;');
        expect(out).toContain('document.createElement("div")');
    });

    it('compiles attributes', () => {
        const out = compile('const a = <div id="test" data-custom="yes" />;');
        expect(out).toContain('.id = "test"'); // Direct prop assignment
        expect(out).toContain('_setProperty(_el, "data-custom", "yes")');
    });

    it('compiles dynamic properties', () => {
        const out = compile('const a = <input value={val} />;');
        expect(out).toContain('_effect(() => _setProperty(_el, "value", val))');
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

    it('executes boolean, data, aria, style, and spread props', () => {
        const attrs = runtime.state({ 'data-source': 'spread', title: 'Old' });
        const element = execute(
            '<button {...attrs.value} disabled aria-label="Save" style={{ color: "red" }}>Save</button>',
            { attrs }
        ) as HTMLButtonElement;

        expect(element.disabled).toBe(true);
        expect(element.getAttribute('aria-label')).toBe('Save');
        expect(element.dataset.source).toBe('spread');
        expect(element.style.color).toBe('red');

        attrs.value = { 'data-source': 'updated', title: 'New' };
        expect(element.dataset.source).toBe('updated');
        expect(element.title).toBe('New');

        attrs.value = { 'data-source': 'final' };
        expect(element.title).toBe('');
    });

    it('creates SVG elements in the SVG namespace', () => {
        const svg = execute('<svg viewBox="0 0 10 10"><path className="route" strokeWidth={2} /></svg>') as SVGElement;
        const path = svg.firstElementChild!;

        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(path.getAttribute('class')).toBe('route');
        expect(path.getAttribute('stroke-width')).toBe('2');
    });

    it('passes boolean and spread props to components', () => {
        const Component = (props: Record<string, unknown>) => props;
        const result = execute('<Component {...values} active />', {
            Component,
            values: { label: 'Ready' },
        });

        expect(result).toEqual({ label: 'Ready', active: true });
    });
});
