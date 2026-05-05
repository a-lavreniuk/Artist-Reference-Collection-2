import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AddCardsPage from './pages/AddCardsPage';
import CollectionDetailPage from './pages/CollectionDetailPage';
import CollectionsPage from './pages/CollectionsPage';
import GalleryCardEditStubPage from './pages/GalleryCardEditStubPage';
import GalleryPage from './pages/GalleryPage';
import MoodboardPage from './pages/MoodboardPage';
import OnboardingStubPage from './pages/OnboardingStubPage';
import SettingsPage from './pages/SettingsPage';
import TagsPage from './pages/TagsPage';
import UiKitPage from './ui-kit/UiKitPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/gallery" replace />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="gallery/:cardId/edit" element={<GalleryCardEditStubPage />} />
        <Route path="onboarding" element={<OnboardingStubPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="collections/:collectionId" element={<CollectionDetailPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="moodboard" element={<MoodboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="ui-kit" element={<UiKitPage />} />
        <Route path="add" element={<AddCardsPage />} />
      </Route>
      <Route path="/navbar" element={<Navigate to="/gallery" replace />} />
      <Route path="*" element={<Navigate to="/gallery" replace />} />
    </Routes>
  );
}
