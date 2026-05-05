import { useSearchParams } from 'react-router-dom';
import MoodboardBoardView from '../components/moodboard/MoodboardBoardView';
import MoodboardCardsView from '../components/moodboard/MoodboardCardsView';

export default function MoodboardPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mf') ?? 'cards';

  if (mode === 'board') {
    return <MoodboardBoardView />;
  }

  return <MoodboardCardsView />;
}
