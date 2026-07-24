import { describe, expect, it, vi } from 'vitest';
import { CommandBus, EventBus } from './bus';

describe('EventBus', () => {
    it('emits typed payloads and unsubscribes listeners', () => {
        const bus = new EventBus();
        const listener = vi.fn<(value: number) => void>();
        const unsubscribe = bus.on('wallet.updated', listener);

        bus.emit('wallet.updated', 500);
        unsubscribe();
        bus.emit('wallet.updated', 700);
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(500);
    });
});

describe('CommandBus', () => {
    it('dispatches registered commands and rejects unknown commands', async () => {
        const bus = new CommandBus();
        bus.register<{ id: string }, string>('item.save', command => command.payload.id);

        await expect(bus.dispatch({ type: 'item.save', payload: { id: 'ITEM-1' } }))
            .resolves.toBe('ITEM-1');
        await expect(bus.dispatch({ type: 'missing', payload: null }))
            .rejects.toThrow('No handler registered');
    });
});
