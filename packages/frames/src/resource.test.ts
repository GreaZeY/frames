import { describe, expect, it, vi } from 'vitest';
import { resource } from './resource';
import { state } from './reactivity';

describe('resource', () => {
    it('loads reactively and ignores stale responses', async () => {
        const key = state('first');
        const resolvers = new Map<string, (value: string) => void>();
        const request = resource(
            () => key.value,
            value => new Promise(resolve => resolvers.set(value, resolve)),
        );

        key.value = 'second';
        resolvers.get('first')?.('stale');
        resolvers.get('second')?.('current');
        await Promise.resolve();

        expect(request.data.value).toBe('current');
        expect(request.loading.value).toBe(false);
    });

    it('aborts the active request when disposed', () => {
        const aborted = vi.fn();
        const request = resource(
            () => 'records',
            (_value, signal) => new Promise(() => signal.addEventListener('abort', aborted)),
        );

        request.dispose();
        expect(aborted).toHaveBeenCalledOnce();
    });

    it('aborts the active request when its source is disabled', () => {
        const enabled = state(true);
        const aborted = vi.fn();
        resource(
            () => enabled.value && 'records',
            (_value, signal) => new Promise(() => signal.addEventListener('abort', aborted)),
        );

        enabled.value = false;
        expect(aborted).toHaveBeenCalledOnce();
    });

    it('keeps existing data while a refetch is loading', async () => {
        let resolve!: (value: string) => void;
        const request = resource(
            () => 'records',
            () => new Promise(done => { resolve = done; }),
            'cached',
        );

        expect(request.data.value).toBe('cached');
        expect(request.loading.value).toBe(true);
        resolve('fresh');
        await Promise.resolve();
        expect(request.data.value).toBe('fresh');
    });
});
