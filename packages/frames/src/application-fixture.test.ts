/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { createContext, useContext } from './context';
import { lazy } from './lazy';
import { Portal } from './portal';
import { state, effect } from './reactivity';
import {
    navigate,
    Outlet,
    Redirect,
    Router,
    searchParams,
    useParams,
} from './router';
import { insert, setProperty } from './runtime';
import { render } from './testing';

const Session = createContext({ authenticated: false, organization: '' });

afterEach(() => {
    document.body.textContent = '';
    navigate('/', true);
});

describe('application integration', () => {
    it('keeps the shell while a protected lazy detail route loads', async () => {
        let resolveModule!: (module: {
            default: (props: { id: string }) => Node;
        }) => void;
        const RecordDetail = lazy<{ id: string }, Node>(() => new Promise(resolve => {
            resolveModule = resolve;
        }));
        const routes = [{
            pending: 'loading record',
            error: (error: unknown) => document.createTextNode((error as Error).message),
            component: () => {
                const shell = document.createElement('main');
                shell.dataset.shell = 'application';
                insert(shell, Outlet());
                return shell;
            },
            children: [{
                path: 'records/:id',
                component: () => {
                    const session = useContext(Session)!;
                    if (!session.authenticated) return Redirect({ to: '/login' });
                    return RecordDetail({ id: useParams().id });
                },
            }],
        }];

        navigate('/records/REC-1?tab=activity', true);
        const view = render(() => Session.Provider({
            value: { authenticated: true, organization: 'ORG-1' },
            children: () => Router({ routes }),
        }));

        await Promise.resolve();
        expect(view.container.textContent).toBe('loading record');
        resolveModule({
            default: ({ id }) => document.createTextNode(
                `${id}:${useContext(Session)?.organization}:${searchParams().get('tab')}`,
            ),
        });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(view.container.querySelector('[data-shell="application"]')?.textContent)
            .toBe('REC-1:ORG-1:activity');
        view.unmount();
    });

    it('supports controlled fields inside a portal and cleans them up', () => {
        const value = state('draft');
        const view = render(() => {
            const page = document.createElement('main');
            const dialog = document.createElement('dialog');
            const input = document.createElement('input');
            effect(() => setProperty(input, 'value', value.value));
            input.addEventListener('input', () => { value.value = input.value; });
            dialog.appendChild(input);
            insert(page, Portal({ children: dialog }));
            return page;
        });
        const input = document.body.querySelector('dialog input') as HTMLInputElement;

        expect(input.value).toBe('draft');
        input.value = 'saved';
        input.dispatchEvent(new Event('input'));
        expect(value.value).toBe('saved');
        view.unmount();
        expect(document.body.querySelector('dialog')).toBeNull();
    });
});
