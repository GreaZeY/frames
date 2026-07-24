import { describe, expect, it } from 'vitest';
import { Registry } from './registry';

describe('Registry', () => {
    it('resolves by priority and unregisters entries', () => {
        const registry = new Registry<string>();
        registry.register('view', 'default');
        const unregister = registry.register('view', 'custom', 10);

        expect(registry.resolve('view')).toBe('custom');
        expect(registry.resolveAll('view')).toEqual(['custom', 'default']);
        unregister();
        expect(registry.resolve('view')).toBe('default');
    });
});
