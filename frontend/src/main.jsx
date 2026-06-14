import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { aplicarCorCacheada } from './lib/tema';

// Aplica a cor de destaque salva (cache local) ANTES de renderizar, pra não
// "piscar" o laranja padrão antes de a cor personalizada carregar.
aplicarCorCacheada();

// Garante que o novo service worker ativa imediatamente e a página recarrega
// sozinha quando há versão nova — assim o cliente SEMPRE vê o cardápio
// atualizado (preços/itens) sem precisar limpar cache.
if ('serviceWorker' in navigator) {
  // Recarrega quando um novo SW assume controle (com guarda anti-loop)
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });

  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
          novo.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // CHECAGEM PERIÓDICA: enquanto a aba fica aberta, verifica a cada 60s se
    // saiu versão nova. Sem isso, uma aba aberta só atualizaria após ~24h.
    const checar = () => { reg.update().catch(() => {}); };
    setInterval(checar, 60000);
    // Também checa quando o cliente volta para a aba/app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checar();
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: { fontSize: '14px', maxWidth: '360px' },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  </QueryClientProvider>
);
