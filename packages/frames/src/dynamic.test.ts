// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Dynamic } from './dynamic';
import { mount } from './runtime';
import { state } from './reactivity';

describe('Dynamic', () => {
    it('renders a reactive intrinsic element with children and events', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);
        const className = state('before');
        const click = vi.fn();

        mount(() => Dynamic({
            component: 'button',
            get className() { return className.value; },
            onClick: click,
            children: 'Create order',
        }), root);

        const button = root.querySelector('button')!;
        expect(button.className).toBe('before');
        expect(button.textContent).toBe('Create order');
        button.click();
        expect(click).toHaveBeenCalledOnce();

        className.value = 'after';
        expect(button.className).toBe('after');
        root.remove();
    });

    it('replaces the element when the selected component changes', () => {
        const root = document.createElement('div');
        const tag = state<'div' | 'section'>('div');

        mount(() => Dynamic({
            get component() { return tag.value; },
            children: 'Details',
        }), root);

        expect(root.firstElementChild?.tagName).toBe('DIV');
        tag.value = 'section';
        expect(root.firstElementChild?.tagName).toBe('SECTION');
        expect(root.textContent).toBe('Details');
    });

    it('forwards props to component functions without the selector prop', () => {
        const root = document.createElement('div');
        const received: Record<string, unknown>[] = [];
        const Component = (props: Record<string, unknown>) => {
            received.push(props);
            const element = document.createElement('p');
            element.textContent = String(props.children);
            return element;
        };

        mount(() => Dynamic({
            component: Component,
            children: 'Forwarded',
            title: 'Summary',
        }), root);

        expect(root.textContent).toBe('Forwarded');
        expect(received[0].component).toBeUndefined();
        expect(received[0].title).toBe('Summary');
    });
});
