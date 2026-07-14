import './style.css';
import { state, derived, effect, store, insert, mount, renderList, Route, Link, createContext, useContext } from 'frames';

// Expose to compiled JSX
(window as any).insert = insert;
(window as any).effect = effect;

// ─── Theme Context ───────────────────────────────────────────────────────────

const ThemeContext = createContext(state('dark'));

// ─── Shared Components ───────────────────────────────────────────────────────

function Nav() {
    const theme = useContext(ThemeContext)!;
    
    return (
        <nav class="nav-container">
            <div style="display: flex; gap: 1rem;">
                <Link to="/" class="btn-primary">Home</Link>
                <Link to="/todos" class="btn-secondary">Todo List</Link>
                <Link to="/profile" class="btn-secondary">Async Profile</Link>
                <Link to="/settings" class="btn-secondary">Settings</Link>
            </div>
            <button 
                class="btn-secondary" 
                onClick={() => theme.value = theme.value === 'dark' ? 'light' : 'dark'}
            >
                Toggle Theme: {theme.value}
            </button>
        </nav>
    );
}

// ─── Pages ───────────────────────────────────────────────────────────────────

function HomePage() {
    const count = state(0);
    const doubled = derived(() => count.value * 2);

    return (
        <>
            <h2>Home Page</h2>
            <p class="subtitle">Welcome to the native router demo.</p>

            <div class="card">
                <div class="card-title">Reactive Counter</div>
                <div class="counter-display">{count.value}</div>
                <div class="counter-derived">
                    doubled = {doubled.value}
                </div>
                <div class="btn-row">
                    <button class="btn-primary" onClick={() => count.value++}>Increment</button>
                    <button class="btn-secondary" onClick={() => count.value--}>Decrement</button>
                </div>
            </div>
            <div style="margin-top: 1rem; color: #888; font-size: 0.8rem; text-align: center;">
                <em>(This page is wrapped in a <code>&lt;&gt;Fragment&lt;/&gt;</code>)</em>
            </div>
        </>
    );
}

function TodosPage() {
    let nextId = 4;
    const todos = state([
        { id: 1, text: 'Build the reactivity engine' },
        { id: 2, text: 'Write the JSX compiler' },
        { id: 3, text: 'Build the native router' },
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
            <h2>Todo List</h2>
            <p class="subtitle">Keyed list reconciliation via Longest Increasing Subsequence.</p>

            <div class="card">
                <div class="todo-input-row">
                    <input id="todo-input" class="todo-input" placeholder="Add a task..." onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') addTodo(); }} />
                    <button class="btn-primary" onClick={addTodo}>Add</button>
                </div>
                <div id="todo-list-container"></div>
            </div>
        </div>
    );

    // Mount keyed list manually as we still need a <For> component wrapper for JSX
    setTimeout(() => {
        const container = document.getElementById('todo-list-container');
        if (container) {
            renderList(container, () => todos.value, t => t.id, t => {
                const item = (
                    <div class="todo-item">
                        <span class="text">{t.text}</span>
                        <button class="remove-btn" onClick={() => removeTodo(t.id)}>✕</button>
                    </div>
                );
                return item as Node;
            });
        }
    }, 0);

    return el;
}

async function UserProfile({ id }: { id: number }) {
    await new Promise(r => setTimeout(r, 1200));
    return (
        <div class="user-profile">
            <div class="avatar">U</div>
            <div class="user-info">
                <h3>User #{id}</h3>
                <p>Role: Admin</p>
            </div>
        </div>
    );
}

function ProfilePage() {
    return (
        <div>
            <h2>Profile Page</h2>
            <p class="subtitle">Showcasing native Async component support.</p>
            <div class="card">
                {UserProfile({ id: 123 })}
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
            <h2>Settings Page</h2>
            <p class="subtitle">Showcasing deep proxy reactivity via <code>store()</code>.</p>
            <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label><strong>Name:</strong></label>
                    <input 
                        type="text" 
                        value={config.user.name} 
                        onInput={(e: Event) => config.user.name = (e.target as HTMLInputElement).value}
                        class="todo-input"
                        style="margin-left: 1rem;"
                    />
                </div>
                <div>
                    <label>
                        <input 
                            type="checkbox" 
                            checked={config.user.preferences.notifications}
                            onChange={(e: Event) => config.user.preferences.notifications = (e.target as HTMLInputElement).checked}
                        />
                        Enable Notifications
                    </label>
                </div>
                
                <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.05); border-radius: 4px;">
                    <h4>Live JSON Preview:</h4>
                    <pre style="margin: 0; font-size: 0.85rem;">
                        {() => JSON.stringify(config, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}

// ─── App Root ────────────────────────────────────────────────────────────────

function App() {
    // Global theme state
    const theme = state('dark');

    // Sync theme to document body class
    effect(() => {
        document.body.className = `theme-${theme.value}`;
    });

    return (
        <ThemeContext.Provider value={theme}>
            <div>
                <h1>Frames</h1>
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
