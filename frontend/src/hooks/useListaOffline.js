/**
 * useListaOffline
 * Lista de compras offline-first com fila de sincronização.
 *
 * Fluxo:
 *  - Online: busca da API, atualiza cache local, executa mutações direto.
 *  - Offline: lê do localStorage, enfileira mutações.
 *  - Reconecta: processa a fila silenciosamente, depois refaz o fetch.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

const CACHE_KEY = 'sushi_lista_cache';
const FILA_KEY  = 'sushi_lista_fila';

// ── helpers de storage ──────────────────────────────────
function lerCache()  { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; } }
function salvarCache(lista) { localStorage.setItem(CACHE_KEY, JSON.stringify(lista)); }
function lerFila()   { try { return JSON.parse(localStorage.getItem(FILA_KEY)  || '[]'); } catch { return []; } }
function salvarFila(fila)   { localStorage.setItem(FILA_KEY, JSON.stringify(fila));  }

// ── executa uma operação da fila contra a API ────────────
async function executarOp(op) {
  switch (op.tipo) {
    case 'adicionar':
      return api.post('/lista-compras', op.payload);
    case 'marcar':
      return api.patch(`/lista-compras/${op.id}/comprado`, op.payload);
    case 'remover':
      return api.del(`/lista-compras/${op.id}`);
    case 'editar':
      return api.put(`/lista-compras/${op.id}`, op.payload);
    default:
      throw new Error(`Operação desconhecida: ${op.tipo}`);
  }
}

// ── hook principal ────────────────────────────────────────
export function useListaOffline() {
  const [lista,    setLista]    = useState(() => lerCache());
  const [online,   setOnline]   = useState(() => navigator.onLine);
  const [syncing,  setSyncing]  = useState(false);
  const [qtdFila,  setQtdFila]  = useState(() => lerFila().length);
  const [loading,  setLoading]  = useState(false);
  const syncRef = useRef(false); // evita duplo sync

  // ── atualizar lista no estado + cache ──────────────────
  function atualizar(novaLista) {
    setLista(novaLista);
    salvarCache(novaLista);
  }

  // ── enfileirar operação offline ────────────────────────
  function enfileirar(op) {
    const fila = [...lerFila(), { ...op, _uid: `${Date.now()}_${Math.random()}` }];
    salvarFila(fila);
    setQtdFila(fila.length);
  }

  // ── buscar lista da API e atualizar cache ──────────────
  const buscar = useCallback(async () => {
    setLoading(true);
    try {
      const dados = await api.get('/lista-compras');
      atualizar(dados);
    } catch {
      // offline: usa o que já está no cache (já no estado)
    } finally {
      setLoading(false);
    }
  }, []);

  // ── processar fila de operações pendentes ──────────────
  const processarFila = useCallback(async () => {
    if (syncRef.current) return;
    const fila = lerFila();
    if (!fila.length) return;

    syncRef.current = true;
    setSyncing(true);
    const filaRestante = [];

    for (const op of fila) {
      // Itens com id negativo (temporário) — precisamos do id real
      // Para 'marcar' e 'remover', se o id for temporário e ainda não
      // sincronizou, pula (o add virá antes na fila)
      try {
        const resultado = await executarOp(op);

        // Se era um "adicionar", trocar o id temporário pelo real em toda a fila restante
        if (op.tipo === 'adicionar' && resultado?.id && op._tempId) {
          const idReal = resultado.id;
          // Atualiza na lista local
          setLista(prev => {
            const nova = prev.map(i => i.id === op._tempId ? { ...i, id: idReal } : i);
            salvarCache(nova);
            return nova;
          });
          // Atualiza referências na fila restante
          for (const ops of filaRestante) {
            if (ops.id === op._tempId) ops.id = idReal;
          }
        }
      } catch {
        filaRestante.push(op); // mantém na fila se falhar
      }
    }

    salvarFila(filaRestante);
    setQtdFila(filaRestante.length);
    setSyncing(false);
    syncRef.current = false;
  }, []);

  // ── monitorar online/offline ───────────────────────────
  useEffect(() => {
    async function aoFicarOnline() {
      setOnline(true);
      await processarFila();
      await buscar();
    }
    function aoFicarOffline() { setOnline(false); }

    window.addEventListener('online',  aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    return () => {
      window.removeEventListener('online',  aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
    };
  }, [buscar, processarFila]);

  // ── ao montar: se já online e tem fila, processa imediatamente ──
  // (cobre o caso em que o WiFi já estava ligado antes do app abrir)
  useEffect(() => {
    async function init() {
      if (navigator.onLine && lerFila().length > 0) {
        await processarFila();
      }
      await buscar();
    }
    init();
  }, []);

  // ── verificação periódica da fila (backup para eventos perdidos) ──
  useEffect(() => {
    const intervalo = setInterval(async () => {
      if (navigator.onLine && lerFila().length > 0) {
        await processarFila();
        await buscar();
      }
    }, 15000); // checa a cada 15s
    return () => clearInterval(intervalo);
  }, [processarFila, buscar]);

  // ── mutações offline-aware ─────────────────────────────

  async function adicionarItem(payload) {
    const tempId = -(Date.now());
    const novo = {
      id: tempId,
      comprado: 0,
      valor_pago: null,
      qtd_comprada: null,
      unidade_comprada: null,
      ingrediente_id: null,
      created_at: new Date().toISOString(),
      ...payload,
    };
    // Otimista: mostra na lista imediatamente
    atualizar([novo, ...lista]);

    if (online) {
      try {
        const r = await api.post('/lista-compras', payload);
        // Substitui id temporário pelo real
        setLista(prev => {
          const nova = prev.map(i => i.id === tempId ? { ...i, id: r.id } : i);
          salvarCache(nova);
          return nova;
        });
      } catch {
        // Falhou online — enfileira
        enfileirar({ tipo: 'adicionar', payload, _tempId: tempId });
      }
    } else {
      enfileirar({ tipo: 'adicionar', payload, _tempId: tempId });
    }
  }

  async function marcarItem(id, comprado, extra = {}) {
    const payload = { comprado, ...extra };
    // Otimista
    atualizar(lista.map(i =>
      i.id === id
        ? { ...i, comprado: comprado ? 1 : 0, ...extra }
        : i
    ));

    if (online) {
      try {
        await api.patch(`/lista-compras/${id}/comprado`, payload);
      } catch {
        enfileirar({ tipo: 'marcar', id, payload });
      }
    } else {
      enfileirar({ tipo: 'marcar', id, payload });
    }
  }

  async function removerItem(id) {
    // Otimista
    atualizar(lista.filter(i => i.id !== id));

    if (id < 0) {
      // Era um item temporário (nunca chegou ao servidor) — remove da fila de add
      const fila = lerFila().filter(op => !(op.tipo === 'adicionar' && op._tempId === id));
      salvarFila(fila);
      setQtdFila(fila.length);
      return;
    }

    if (online) {
      try {
        await api.del(`/lista-compras/${id}`);
      } catch {
        enfileirar({ tipo: 'remover', id });
      }
    } else {
      enfileirar({ tipo: 'remover', id });
    }
  }

  async function editarItem(id, payload) {
    atualizar(lista.map(i => i.id === id ? { ...i, ...payload } : i));

    if (online) {
      try {
        await api.put(`/lista-compras/${id}`, payload);
      } catch {
        enfileirar({ tipo: 'editar', id, payload });
      }
    } else {
      enfileirar({ tipo: 'editar', id, payload });
    }
  }

  return {
    lista, online, syncing, loading, qtdFila,
    buscar,
    adicionarItem, marcarItem, removerItem, editarItem,
  };
}
