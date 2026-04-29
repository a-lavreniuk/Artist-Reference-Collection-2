import { Link, Route, Routes } from 'react-router-dom';
import UiKitPage from './ui-kit/UiKitPage';
import NavbarPage from './navbar/NavbarPage';

function Home() {
  return (
    <main className="arc2-home">
      <h1>ARC 2 Dev Environment</h1>
      <p>Токены и UI-элементы подключены. Выберите страницу для сверки.</p>
      <nav className="arc2-home__nav">
        <Link to="/ui-kit">UI-Kit</Link>
        <Link to="/navbar">Navbar</Link>
      </nav>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ui-kit" element={<UiKitPage />} />
      <Route path="/navbar" element={<NavbarPage />} />
    </Routes>
  );
}
