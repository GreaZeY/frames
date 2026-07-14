import { describe, it, expect } from 'vitest';
import { createContext, useContext } from './context';

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
});
