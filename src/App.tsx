import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Users from './pages/Users';
import FloatingRecorder from './components/FloatingRecorder';
import Replay from './pages/Replay';
import Other from './pages/Other';

export function App() {
  return (
    <HashRouter>
      <div className="layout">
        <nav className="nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            首页
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            用户
          </NavLink>
          <NavLink
            to="/replay"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            回放
          </NavLink>
          <NavLink
            to="/other"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            其他
          </NavLink>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/users" element={<Users />} />
            <Route path="/replay" element={<Replay />} />
            <Route path="/other" element={<Other />} />
          </Routes>
        </main>
      </div>
      {/* 全局右下角悬浮录制按钮 */}
      <FloatingRecorder />
    </HashRouter>
  );
}
