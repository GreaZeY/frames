import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateQuery, query } from './query';

describe('query', () => {
    beforeEach(() => invalidateQuery());

    it('deduplicates concurrent requests and reuses fresh cache data', async () => {
        const fetcher = vi.fn(async () => ['record']);
        const first = query({ key: () => ['records'], fetcher, staleTime: Infinity });
        const second = query({ key: () => ['records'], fetcher, staleTime: Infinity });

        await new Promise(resolve => setTimeout(resolve, 0));
        expect(fetcher).toHaveBeenCalledOnce();
        expect(first.data.value).toEqual(['record']);
        expect(second.data.value).toEqual(['record']);

        const third = query({ key: () => ['records'], fetcher, staleTime: Infinity });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(third.data.value).toEqual(['record']);
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it('forces a new request when refetched', async () => {
        const fetcher = vi.fn(async () => fetcher.mock.calls.length);
        const request = query({ key: () => ['records'], fetcher, staleTime: Infinity });
        await Promise.resolve();
        await request.refetch();
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(request.data.value).toBe(2);
    });
});
