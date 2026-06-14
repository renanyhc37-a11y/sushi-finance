import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useBoletoAlert() {
  const { data: boletos = [] } = useQuery({
    queryKey: ['boletos'],
    queryFn: () => api.get('/boletos'),
    staleTime: 1000 * 60 * 10, // 10 min
  });

  useEffect(() => {
    if (!boletos.length) return;

    const hoje = new Date();
    const urgentes = boletos.filter(b => {
      if (b.status === 'pago') return false;
      const venc = new Date(b.data_vencimento + 'T12:00:00');
      const dias = Math.ceil((venc - hoje) / 86400000);
      return dias <= 3;
    });

    if (!urgentes.length) return;

    // Notificação do browser
    const notificar = () => {
      urgentes.forEach(b => {
        const venc = new Date(b.data_vencimento + 'T12:00:00');
        const dias = Math.ceil((venc - new Date()) / 86400000);
        const msg = dias < 0
          ? `⚠️ Vencido há ${Math.abs(dias)} dia(s)!`
          : dias === 0
          ? '⚠️ Vence HOJE!'
          : `Vence em ${dias} dia(s)`;

        new Notification(`🧾 Boleto: ${b.fornecedor}`, {
          body: `${msg} · ${Number(b.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          icon: '/favicon.ico',
          tag: `boleto-${b.id}`,
        });
      });
    };

    if (Notification.permission === 'granted') {
      notificar();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') notificar();
      });
    }
  }, [boletos]);

  // Retorna resumo para banner in-app
  const hoje = new Date();
  const alertas = boletos.filter(b => {
    if (b.status === 'pago') return false;
    const venc = new Date(b.data_vencimento + 'T12:00:00');
    const dias = Math.ceil((venc - hoje) / 86400000);
    return dias <= 3;
  });

  return alertas;
}
