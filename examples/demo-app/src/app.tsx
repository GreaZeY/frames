import { state, effect, derived, lazy, mount, Route, Link, currentPath, createContext, useContext } from 'frames';
import './style.css';

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

// ─── Lazy Loaded Page Components ──────────────────────────────────────────────

const HomePage = lazy(() => import('./pages/HomePage'));
const TodosPage = lazy(() => import('./pages/TodosPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

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
