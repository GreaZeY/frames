/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { state, effect, onCleanup } from './reactivity';
import { Portal } from './portal';
import { insert } from './runtime';

describe('Portal', () => {
    it('renders children into the specified mount node', () => {
        const root = document.createElement('div');
        const mountTarget = document.createElement('div');
        document.body.appendChild(mountTarget);
        
        // Render Portal into root
        const result = Portal({ mount: mountTarget, children: "Hello Portal" });
        
        expect(result).toBeInstanceOf(Comment);
        expect((result as Comment).textContent).toBe("portal-placeholder");
        
        // The mountTarget should contain the wrapper div with display: contents
        expect(mountTarget.childNodes.length).toBe(1);
        const wrapper = mountTarget.childNodes[0] as HTMLElement;
        expect(wrapper.style.display).toBe('contents');
        expect(wrapper.textContent).toBe('Hello Portal');
    });

    it('cleans up wrapper when unmounted', () => {
        const mountTarget = document.createElement('div');
        document.body.appendChild(mountTarget);
        
        let shouldRender = state(true);
        let cleanupSpy = vi.fn();
        
        const Component = () => {
            if (shouldRender.value) {
                onCleanup(cleanupSpy);
                return Portal({ mount: mountTarget, children: "Test" });
            }
            return null;
        };

        const root = document.createElement('div');
        insert(root, Component);
        
        expect(mountTarget.childNodes.length).toBe(1);
        
        // Unmount
        shouldRender.value = false;
        
        // Wait, because we are using batching, updates are synchronous for non-batched sets.
        // Actually our state.set queues batch if batchDepth > 0. Here batchDepth is 0, so it's synchronous!
        expect(cleanupSpy).toHaveBeenCalled();
        expect(mountTarget.childNodes.length).toBe(0);
    });
});
