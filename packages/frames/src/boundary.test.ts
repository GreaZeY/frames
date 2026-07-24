/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { ErrorBoundary, Suspense } from './boundary';
import { insert, mount } from './runtime';

describe('boundaries', () => {
    it('renders a fallback for synchronous errors and can recover', async () => {
        const root = document.createElement('div');
        let shouldThrow = true;

        mount(() => ErrorBoundary({
            children: () => {
                if (shouldThrow) throw new Error('broken');
                return document.createTextNode('ready');
            },
            fallback: (_error, reset) => {
                const button = document.createElement('button');
                button.textContent = 'retry';
                button.onclick = () => {
                    shouldThrow = false;
                    reset();
                };
                return button;
            },
        }), root);

        await Promise.resolve();
        expect(root.textContent).toBe('retry');
        (root.firstElementChild?.firstElementChild as HTMLButtonElement).click();
        expect(root.textContent).toBe('ready');
    });

    it('treats thrown null as an error', async () => {
        const root = document.createElement('div');
        mount(() => ErrorBoundary({
            children: () => { throw null; },
            fallback: () => 'failed',
        }), root);

        await Promise.resolve();
        expect(root.textContent).toBe('failed');
    });

    it('shows a fallback while nested async content is pending', async () => {
        const root = document.createElement('div');
        let resolve!: (value: string) => void;
        const content = new Promise<string>(done => { resolve = done; });

        mount(() => Suspense({
            fallback: 'loading',
            children: () => {
                const section = document.createElement('section');
                insert(section, content);
                return section;
            },
        }), root);

        await Promise.resolve();
        expect(root.textContent).toBe('loading');
        resolve('ready');
        await Promise.resolve();
        await Promise.resolve();
        expect(root.textContent).toBe('ready');
    });
});
