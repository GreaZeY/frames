/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
    currentPath,
    Link,
    matchRoutes,
    navigate,
    Outlet,
    Route,
    Router,
    searchParams,
    useParams,
} from './router';
import { insert, mount } from './runtime';

describe('router navigation', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        navigate('/', true);
    });

    it('keeps pathname, search, and hash in router state', () => {
        navigate('/records?page=2#latest');
        expect(currentPath.value).toBe('/records?page=2#latest');
    });

    it('matches legacy routes by pathname when query or hash exists', () => {
        navigate('/records?page=2#latest');
        expect((Route({ path: '/records', children: 'records' }) as () => string)()).toBe('records');
    });

    it('intercepts an ordinary primary-button link click', () => {
        const link = Link({ to: '/records', children: 'Records' });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });

        link.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(currentPath.value).toBe('/records');
    });

    it('does not intercept modified clicks', () => {
        const link = Link({ to: '/records', children: 'Records' });
        link.addEventListener('click', event => event.preventDefault());
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
        });

        link.dispatchEvent(event);

        expect(currentPath.value).toBe('/');
    });
});

describe('route matching', () => {
    it('matches nested dynamic, optional, and wildcard routes', () => {
        const routes = [{
            component: () => null,
            children: [
                { path: 'records/:id', component: () => null },
                { path: 'products/:tab?', component: () => null },
                { path: 'help/*', component: () => null },
            ],
        }];

        expect(matchRoutes(routes, '/records/REC-1')?.at(-1)?.params).toEqual({ id: 'REC-1' });
        expect(matchRoutes(routes, '/products')?.at(-1)?.params).toEqual({});
        expect(matchRoutes(routes, '/help/guides/routes')?.at(-1)?.params).toEqual({
            '*': 'guides/routes',
        });
    });

    it('renders nested outlets with params and query values', () => {
        const root = document.createElement('div');
        const routes = [{
            component: () => {
                const element = document.createElement('main');
                insert(element, Outlet());
                return element;
            },
            children: [{
                path: 'records/:id',
                component: () => document.createTextNode(
                    `${useParams().id}:${searchParams().get('tab')}`,
                ),
            }],
        }];

        navigate('/records/REC-1?tab=activity', true);
        mount(() => Router({ routes }) as unknown as Node, root);
        expect(root.textContent).toBe('REC-1:activity');
    });

    it('renders not-found content and catches nested route errors', async () => {
        const root = document.createElement('div');
        const routes = [{
            error: (error: unknown) => document.createTextNode((error as Error).message),
            component: Outlet,
            children: [{ path: 'records/:id', component: () => { throw new Error('failed'); } }],
        }];

        navigate('/missing', true);
        const unmount = mount(
            () => Router({ routes, fallback: 'not found' }) as unknown as Node,
            root,
        );
        expect(root.textContent).toBe('not found');

        navigate('/records/REC-1', true);
        await Promise.resolve();
        expect(root.textContent).toBe('failed');
        unmount();
    });

    it('redirects matched routes', async () => {
        const root = document.createElement('div');
        navigate('/', true);
        mount(() => Router({
            routes: [{ path: '', redirect: '/home' }],
        }) as unknown as Node, root);

        await Promise.resolve();
        expect(currentPath.value).toBe('/home');
    });
});
