export const brl = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

export const pct = (v) => `${(v ?? 0).toFixed(1)}%`;

export const mesLabel = (mes) => {
  if (!mes) return '';
  const [ano, m] = mes.split('-');
  return new Date(Number(ano), Number(m) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

export const mesAtual = () => new Date().toISOString().slice(0, 7);
