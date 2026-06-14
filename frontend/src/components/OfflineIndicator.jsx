import { useEffect, useState } from 'react';

export default function OfflineIndicator() {
  const [status, setStatus] = useState('online'); // 'online' | 'offline' | 'back'

  useEffect(() => {
    // Estado inicial
    if (!navigator.onLine) setStatus('offline');

    function handleOffline() {
      setStatus('offline');
    }

    function handleOnline() {
      // Mostra "conexão restaurada" por 3s depois some
      setStatus('back');
      setTimeout(() => setStatus('online'), 3000);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (status === 'online') return null;

  const isOffline = status === 'offline';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,          // acima do bottom nav mobile
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        transition: 'all 0.3s ease',
        background: isOffline
          ? 'linear-gradient(135deg, #1a0a0a, #2a0d0d)'
          : 'linear-gradient(135deg, #0a1a0a, #0d2a0d)',
        border: isOffline
          ? '1px solid rgba(239,68,68,0.4)'
          : '1px solid rgba(34,197,94,0.4)',
        color: isOffline ? '#fca5a5' : '#86efac',
      }}
    >
      <span style={{ fontSize: 15 }}>{isOffline ? '📡' : '✅'}</span>
      {isOffline
        ? 'Sem conexão — exibindo dados salvos'
        : 'Conexão restaurada'}
    </div>
  );
}
