import { Route, Routes } from 'react-router-dom';
import NavbarPage from './navbar/NavbarPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<NavbarPage />} />
      <Route path="/navbar" element={<NavbarPage />} />
    </Routes>
  );
}
