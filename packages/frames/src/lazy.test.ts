/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { lazy } from './lazy';
import { insert } from './runtime';

describe('lazy()', () => {
    it('defers module loading until component execution and caches result', async () => {
        let loadCount = 0;
        const mockModule = {
            default: (props: { text: string }) => {
                const el = document.createElement('div');
                el.textContent = props.text;
                return el;
            }
        };

        const LazyComp = lazy(() => {
            loadCount++;
            return Promise.resolve(mockModule);
        });

        expect(loadCount).toBe(0);

        const parent = document.createElement('div');
        
        // First render returns a Promise (handled by insert)
        const res1 = insert(parent, () => LazyComp({ text: 'Hello' }));
        expect(loadCount).toBe(1);

        // Wait for async resolution
        await new Promise(r => setTimeout(r, 20));

        expect(parent.textContent).toBe('Hello');

        // Second render uses cached component module
        const res2 = LazyComp({ text: 'World' });
        expect(loadCount).toBe(1); // loadCount stays 1
        expect((res2 as HTMLElement).textContent).toBe('World');
    });
});
