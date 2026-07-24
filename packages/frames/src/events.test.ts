/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { delegateEvent } from './events';

describe('delegated events', () => {
    it('exposes the handler element as currentTarget and this', () => {
        const element = document.createElement('button');
        const handler = vi.fn(function (this: HTMLButtonElement, event: Event) {
            expect(this).toBe(element);
            expect(event.currentTarget).toBe(element);
        });
        (element as any).$$click = handler;
        document.body.appendChild(element);
        delegateEvent('click');

        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        element.remove();
    });

    it('respects propagation cancellation between nested handlers', () => {
        const parent = document.createElement('div');
        const child = document.createElement('button');
        const parentHandler = vi.fn();
        const childHandler = vi.fn((event: Event) => event.stopPropagation());
        (parent as any).$$click = parentHandler;
        (child as any).$$click = childHandler;
        parent.appendChild(child);
        document.body.appendChild(parent);
        delegateEvent('click');

        child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(childHandler).toHaveBeenCalledTimes(1);
        expect(parentHandler).not.toHaveBeenCalled();
        parent.remove();
    });
});
