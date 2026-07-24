import { describe, expect, it } from 'vitest';
import { mutation } from './mutation';
import { createRoot } from './reactivity';

describe('mutation', () => {
    it('tracks successful and failed mutation state', async () => {
        const save = mutation(async (value: string) => {
            if (!value) throw new Error('required');
            return value.toUpperCase();
        });

        await expect(save.mutate('entry')).resolves.toBe('ENTRY');
        expect(save.data.value).toBe('ENTRY');
        await expect(save.mutate('')).rejects.toThrow('required');
        expect(save.error.value).toBeInstanceOf(Error);
        expect(save.loading.value).toBe(false);
    });

    it('does not cancel a mutation when its owner is disposed', async () => {
        let finish!: (value: string) => void;
        let dispose = () => {};
        const save = createRoot(disposeRoot => {
            dispose = disposeRoot;
            return mutation(() => new Promise<string>(resolve => { finish = resolve; }));
        });

        const pending = save.mutate(undefined);
        dispose();
        finish('saved');
        await expect(pending).resolves.toBe('saved');
        expect(save.data.value).toBeUndefined();
    });
});
