import { useEffect, useState } from 'react';
import MessageModal from './MessageModal';

export default function PendingRestoreModal() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!window.arc?.consumePendingRestoreModal) return;
    void (async () => {
      const res = await window.arc.consumePendingRestoreModal();
      if (res?.message) setMessage(res.message);
    })();
  }, []);

  if (!message) return null;

  return (
    <MessageModal
      title="Восстановление"
      message={message}
      closeLabel="Понятно"
      onClose={() => setMessage(null)}
    />
  );
}
