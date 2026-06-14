/**
 * useDespesasOffline
 * Despesas offline-first com cache por mês + fila de sincronização.
 *
 * Fluxo:
 *  - Online: busca da API, atualiza cache local, executa mutações direto.
 *  - Offline: lê do localStorage (por mês), enfileira mutações.
 *  - Reconecta: processa a fila, depois refaz o fetch do mês atual.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

const FILA_KEY = 'sushi_despesas_fila';
const cacheKey = (mes) => `sushi_despesas_cache_${mes}`;

// ── helpers de storage ──────────────────────────────────
function lerCache(mes)    { try { return JSON.parse(localStorage.getItem(cacheKey(mes)) || 'null'); } catch { return null; } }
function salvarCache(mes, dados) { localStorage.setItem(cacheKey(mes), JSON.stringify(dados)); }
function lerFila()        { try { return JSON.parse(localStorage.getItem(FILA_KEY) || '[]'); } catch { return []; } }
function salvarFila(fila) { localStorage.setItem(FILA_KEY, JSON.stringify(fila)); }

// ── executa uma operação da fila ────────────────────────
async function executarOp(op) {
  switch (op.tipo) {
    case 'criar':
      return api.post('/despesas', op.payload);
    case 'editar':
      return api.put(`/despesas/${op.id}`, op.payload);
    case 'excluir':
      return api.del(`/despesas/${op.id}`);
    default:
      throw new Error(`Operação desconhecida: ${op.tipo}`);
  }
}

// ── hook principal ────────────────────────────────────────
export function useDespesasOffline(mes) {
  const [despesas, setDespesas] = useState(() => lerCache(mes) || []);
  const [online,   setOnline]   = useState(() => navigator.onLine);
  const [syncing,  setSyncing]  = useState(false);
  const [qtdFila,  setQtdFila]  = useState(() => lerFila().length);
  const [loading,  setLoading]  = useState(false);
  const syncRef = useRef(false);

  // ── quando o mês mudar, carregar o cache daquele mês ──
  useEffect(() => {
    const cached = lerCache(mes);
    if (cached) setDespesas(cached);
    else setDespesas([]); // ainda não tem cache — vai carregar na fetch
  }, [mes]);

  // ── atualizar estado + cache do mês ───────────────────
  function atualizar(dados) {
    setDespesas(dados);
    salvarCache(mes, dados);
  }

  // ── enfileirar operação ────────────────────────────────
  function enfileirar(op) {
    const fila = [...lerFila(), { ...op, _uid: `${Date.now()}_${Math.random()}` }];
    salvarFila(fila);
    setQtdFila(fila.length);
  }

  // ── buscar da API ──────────────────────────────────────
  const buscar = useCallback(async (mesBusca) => {
    const m = mesBusca || mes;
    setLoading(true);
    try {
      const dados = await api.get(`/despesas?mes=${m}`);
      setDespesas(dados);
      salvarCache(m, dados);
    } catch {
      // offline: usa cache
    } finally {
      setLoading(false);
    }
  }, [mes]);

  // ── processar fila ─────────────────────────────────────
  const processarFila = useCallback(async () => {
    if (syncRef.current) return;
    const fila = lerFila();
    if (!fila.length) return;

    syncRef.current = true;
    setSyncing(true);
    const filaRestante = [];

    for (const op of fila) {
      try {
        const resultado = await executarOp(op);

        // Se era um "criar", trocar id temporário pelo real em operações seguintes da fila
        if (op.tipo === 'criar' && resultado?.id && op._tempId) {
          const idReal = resultado.id;
          // Atualiza referências no que ainda resta na fila
          for (const pendente of filaRestante) {
            if (pendente.id === op._tempId) pendente.id = idReal;
          }
          // Atualiza no cache do mês correspondente
          const mesDaOp = op.payload?.data_competencia?.slice(0, 7);
          if (mesDaOp) {
            const cached = lerCache(mesDaOp);
            if (cached) {
              const novo = cached.map(d => d.id === op._tempId ? { ...d, id: idReal } : d);
              salvarCache(mesDaOp, novo);
              if (mesDaOp === mes) setDespesas(novo);
            }
          }
        }
      } catch {
        filaRestante.push(op);
      }
    }

    salvarFila(filaRestante);
    setQtdFila(filaRestante.length);
    setSyncing(false);
    syncRef.current = false;
  }, [mes]);

  // ── monitorar online/offline ───────────────────────────
  useEffect(() => {
    async function aoFicarOnline() {
      setOnline(true);
      await processarFila();
      await buscar(mes);
    }
    function aoFicarOffline() { setOnline(false); }

    window.addEventListener('online',  aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    return () => {
      window.removeEventListener('online',  aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
    };
  }, [buscar, processarFila, mes]);

  // ── ao montar: processa fila se já estiver online ──────
  useEffect(() => {
    async function init() {
      if (navigator.onLine && lerFila().length > 0) {
        await processarFila();
      }
      await buscar(mes);
    }
    init();
  }, [mes]);

  // ── verificação periódica (backup para eventos perdidos) ─
  useEffect(() => {
    const intervalo = setInterval(async () => {
      if (navigator.onLine && lerFila().length > 0) {
        await processarFila();
        await buscar(mes);
      }
    }, 15000);
    return () => clearInterval(intervalo);
  }, [processarFila, buscar, mes]);

  // ── mutações offline-aware ─────────────────────────────

  function criarDespesa(payload) {
    const tempId = -(Date.now());
    const nova = {
      id: tempId,
      recorrente: 0,
      tipo: '',
      ...payload,
      valor: Number(payload.valor),
    };

    // Só exibe na tela se for do mesmo mês
    const mesDaDespesa = payload.data_competencia?.slice(0, 7);
    if (!mesDaDespesa || mesDaDespesa === mes) {
      atualizar([nova, ...despesas]);
    }

    if (online) {
      api.post('/despesas', payload).then(r => {
        if (r?.id) {
          // Substituir id temporário pelo real
          setDespesas(prev => {
            const nova2 = prev.map(d => d.id === tempId ? { ...d, id: r.id } : d);
            salvarCache(mes, nova2);
            return nova2;
          });
        }
      }).catch(() => {
        enfileirar({ tipo: 'criar', payload, _tempId: tempId });
      });
    } else {
      enfileirar({ tipo: 'criar', payload, _tempId: tempId });
    }

    return tempId; // retorna id temporário para quem precisar
  }

  function editarDespesa(id, payload) {
    atualizar(despesas.map(d =>
      d.id === id ? { ...d, ...payload, valor: Number(payload.valor) } : d
    ));

    if (online) {
      api.put(`/despesas/${id}`, payload).catch(() => {
        enfileirar({ tipo: 'editar', id, payload });
      });
    } else {
      enfileirar({ tipo: 'editar', id, payload });
    }
  }

  function excluirDespesa(id) {
    atualizar(despesas.filter(d => d.id !== id));

    if (id < 0) {
      // Item temporário — remove da fila de criar
      const fila = lerFila().filter(op => !(op.tipo === 'criar' && op._tempId === id));
      salvarFila(fila);
      setQtdFila(fila.length);
      return;
    }

    if (online) {
      api.del(`/despesas/${id}`).catch(() => {
        enfileirar({ tipo: 'excluir', id });
      });
    } else {
      enfileirar({ tipo: 'excluir', id });
    }
  }

  return {
    despesas, online, syncing, loading, qtdFila,
    buscar,
    criarDespesa, editarDespesa, excluirDespesa,
  };
}
