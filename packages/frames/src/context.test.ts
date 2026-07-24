import { describe, it, expect } from 'vitest';
import { createContext, useContext } from './context';
import { effect, state } from './reactivity';

describe('Context API', () => {
    it('returns default value when no provider exists', () => {
        const ThemeContext = createContext('light');
        const value = useContext(ThemeContext);
        expect(value).toBe('light');
    });

    it('returns provided value within provider', () => {
        const ThemeContext = createContext('light');
        
        let capturedValue: string = '';

        function Child() {
            capturedValue = useContext(ThemeContext)!;
            return null;
        }

        ThemeContext.Provider({
            value: 'dark',
            children: () => {
                Child();
            }
        });

        expect(capturedValue).toBe('dark');
    });

    it('handles nested providers', () => {
        const ThemeContext = createContext('light');
        
        let outerValue = '';
        let innerValue = '';

        function InnerChild() {
            innerValue = useContext(ThemeContext)!;
        }

        function OuterChild() {
            outerValue = useContext(ThemeContext)!;
            
            ThemeContext.Provider({
                value: 'blue',
                children: () => {
                    InnerChild();
                }
            });
        }

        ThemeContext.Provider({
            value: 'dark',
            children: () => {
                OuterChild();
            }
        });

        expect(outerValue).toBe('dark');
        expect(innerValue).toBe('blue');
    });

    it('preserves provider values when an effect reruns', () => {
        const ThemeContext = createContext('light');
        const count = state(0);
        const values: string[] = [];

        ThemeContext.Provider({
            value: 'dark',
            children: () => effect(() => {
                count.value;
                values.push(useContext(ThemeContext)!);
            }),
        });

        count.value = 1;
        expect(values).toEqual(['dark', 'dark']);
    });
});
