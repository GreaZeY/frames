import './style.css';
import { state, derived, effect, store, insert, mount, renderList, Route, Link, currentPath, createContext, useContext } from 'frames';

// ─── Theme Context ───────────────────────────────────────────────────────────

const ThemeContext = createContext(state('dark'));

// ─── Shared Components ───────────────────────────────────────────────────────

function Nav() {
    const theme = useContext(ThemeContext)!;
    
    // Create a reactive link component that adds an 'active' class
    function NavLink(props: { to: string, children: any }) {
        // We use derived so the class updates automatically when the route changes
        const className = derived(() => currentPath.value === props.to ? "nav-link active" : "nav-link");
        return <Link to={props.to} class={className.value}>{props.children}</Link>;
    }

    return (
        <header class="app-header">
            <div class="brand-title">Frames</div>
            <nav class="nav-container">
                <NavLink to="/">Overview</NavLink>
                <NavLink to="/todos">Reconciliation</NavLink>
                <NavLink to="/profile">Suspense</NavLink>
                <NavLink to="/settings">Proxy Store</NavLink>
            </nav>
            <button 
                class="theme-toggle" 
                onClick={() => theme.value = theme.value === 'dark' ? 'light' : 'dark'}
                title="Toggle Theme"
            >
                {() => theme.value === 'dark' ? '🌙' : '☀️'}
            </button>
        </header>
    );
}

// ─── Pages ───────────────────────────────────────────────────────────────────

function HomePage() {
    const count = state(0);
    const doubled = derived(() => count.value * 2);

    return (
        <>
            <h2>Lightning Fast Reactivity</h2>
            <p class="subtitle">Powered by fine-grained signals and a custom JSX compiler. No Virtual DOM.</p>

            <div class="card">
                <div class="card-title">Signal Counter</div>
                <div class="counter-display">{() => count.value}</div>
                <div class="counter-derived">
                    Computed (x2) = {() => doubled.value}
                </div>
                <div class="btn-row">
                    <button class="btn-primary" onClick={() => count.value++}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Increment
                    </button>
                    <button class="btn-secondary" onClick={() => count.value--}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Decrement
                    </button>
                </div>
            </div>
            <div style="margin-top: 2rem; color: var(--text-secondary-dark); font-size: 0.85rem; text-align: center;">
                <em>This entire UI only renders once. Only the changing text nodes update directly in the DOM.</em>
            </div>
        </>
    );
}

function TodosPage() {
    let nextId = 4;
    const todos = state([
        { id: 1, text: 'Design the reactive primitives' },
        { id: 2, text: 'Build the custom Babel compiler' },
        { id: 3, text: 'Implement surgical DOM reconciliation' },
    ]);

    function addTodo() {
        const input = document.getElementById('todo-input') as HTMLInputElement;
        const text = input.value.trim();
        if (!text) return;
        todos.value = [...todos.value, { id: nextId++, text }];
        input.value = '';
    }

    function removeTodo(id: number) {
        todos.value = todos.value.filter(t => t.id !== id);
    }

    const el = (
        <div>
            <h2>List Reconciliation</h2>
            <p class="subtitle">Highly optimized array diffing using Longest Increasing Subsequence.</p>

            <div class="card">
                <div class="todo-input-row">
                    <input id="todo-input" class="todo-input" placeholder="What needs to be done?" onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') addTodo(); }} />
                    <button class="btn-primary" onClick={addTodo}>Add Task</button>
                </div>
                <div id="todo-list-container"></div>
            </div>
        </div>
    );

    // Mount keyed list manually 
    setTimeout(() => {
        const container = document.getElementById('todo-list-container');
        if (container) {
            renderList(container, () => todos.value, t => t.id, t => {
                const item = (
                    <div class="todo-item">
                        <span class="text">{t.text}</span>
                        <button class="remove-btn" onClick={() => removeTodo(t.id)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                );
                return item as Node;
            });
        }
    }, 0);

    return el;
}

async function UserProfile({ id }: { id: number }) {
    // Simulate a network waterfall
    await new Promise(r => setTimeout(r, 1200));
    return (
        <div class="user-profile">
            <div class="avatar">U</div>
            <div class="user-info">
                <h3>User ID: {id}</h3>
                <p>Status: Authenticated</p>
            </div>
        </div>
    );
}

function ProfilePage() {
    return (
        <div>
            <h2>Async Components</h2>
            <p class="subtitle">First-class support for async functions and automatic Suspense boundaries.</p>
            <div class="card">
                <div class="card-title">Network Request Simulation</div>
                {UserProfile({ id: 1042 })}
            </div>
        </div>
    );
}

function SettingsPage() {
    const config = store({
        user: {
            name: 'Alice',
            preferences: {
                notifications: true,
                theme: 'System Default'
            }
        }
    });

    return (
        <div>
            <h2>Deep Proxy Store</h2>
            <p class="subtitle">Mutate deeply nested objects and trigger surgical updates automatically.</p>
            <div class="card" style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <label style="font-weight: 500; min-width: 120px;">Display Name</label>
                    <input 
                        type="text" 
                        value={() => config.user.name} 
                        onInput={(e: Event) => config.user.name = (e.target as HTMLInputElement).value}
                        class="todo-input"
                    />
                </div>
                
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <label style="font-weight: 500; min-width: 120px;">Notifications</label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input 
                            type="checkbox" 
                            style="width: 18px; height: 18px; accent-color: #6366f1;"
                            checked={() => config.user.preferences.notifications}
                            onChange={(e: Event) => config.user.preferences.notifications = (e.target as HTMLInputElement).checked}
                        />
                        Enable Push Alerts
                    </label>
                </div>
                
                <div class="json-preview">
                    {() => JSON.stringify(config, null, 2)}
                </div>
                
            </div>
        </div>
    );
}

// ─── App Root ────────────────────────────────────────────────────────────────

function App() {
    const theme = state('dark');

    effect(() => {
        document.body.className = `theme-${theme.value}`;
    });

    return (
        <ThemeContext.Provider value={theme}>
            <div>
                <Nav />
                
                <div class="router-view">
                    <Route path="/">
                        <HomePage />
                    </Route>
                    
                    <Route path="/todos">
                        <TodosPage />
                    </Route>
                    
                    <Route path="/profile">
                        <ProfilePage />
                    </Route>
                    
                    <Route path="/settings">
                        <SettingsPage />
                    </Route>
                </div>
            </div>
        </ThemeContext.Provider>
    );
}

mount(App, '#app');
