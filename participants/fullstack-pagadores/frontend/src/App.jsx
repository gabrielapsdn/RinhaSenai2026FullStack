import { Routes, Route, Link, useLocation } from 'react-router'
import Dashboard from './pages/Dashboard.jsx'
import History from './pages/History.jsx'
import Detail from './pages/Detail.jsx'
import './styles.css'

function Shell({ children }) {
  const location = useLocation()
  const historyActive = location.pathname.startsWith('/history') || location.pathname.startsWith('/transaction')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/"><span className="brand-mark">P</span><span><strong>pagadores</strong><small>payment workspace</small></span></Link>
        <div className="sidebar-label">Workspace</div>
        <nav className="main-nav" aria-label="Navegacao principal">
          <Link className={!historyActive ? 'nav-link active' : 'nav-link'} to="/"><span>↗</span> Visao geral</Link>
          <Link className={historyActive ? 'nav-link active' : 'nav-link'} to="/history"><span>≡</span> Transacoes</Link>
        </nav>
        <div className="sidebar-foot"><span className="status-dot" /> API conectada <small>v1.0.0</small></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><span className="eyebrow">OPERACOES / PAGAMENTOS</span><span className="topbar-date">15 SET 2026 <span className="avatar">FP</span></span></header>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/transaction/:id" element={<Detail />} />
      </Routes>
    </Shell>
  )
}
