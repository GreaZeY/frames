/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { currentPath, Link, navigate } from './router';

describe('router navigation', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        navigate('/', true);
    });

    it('keeps pathname, search, and hash in router state', () => {
        navigate('/orders?page=2#latest');
        expect(currentPath.value).toBe('/orders?page=2#latest');
    });

    it('intercepts an ordinary primary-button link click', () => {
        const link = Link({ to: '/orders', children: 'Orders' });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });

        link.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(currentPath.value).toBe('/orders');
    });

    it('does not intercept modified clicks', () => {
        const link = Link({ to: '/orders', children: 'Orders' });
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
        });

        link.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(currentPath.value).toBe('/');
    });
});
