import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import TagsPage from './pages/TagsPage';
import UiKitPage from './ui-kit/UiKitPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/gallery" replace />} />
        <Route path="gallery" element={null} />
        <Route path="gallery/:cardId/edit" element={null} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="collections" element={null} />
        <Route path="collections/:collectionId" element={null} />
        <Route path="moodboard" element={null} />
        <Route path="settings" element={null} />
        <Route path="add" element={null} />
      </Route>
      <Route path="/navbar" element={<Navigate to="/gallery" replace />} />
      <Route path="/ui-kit" element={<UiKitPage />} />
      <Route path="*" element={<Navigate to="/gallery" replace />} />
    </Routes>
  );
}
