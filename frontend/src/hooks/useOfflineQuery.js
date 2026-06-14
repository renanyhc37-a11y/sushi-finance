/**
 * useOfflineQuery
 * Substituto direto do useQuery com cache automático no localStorage.
 *
 * - Online:  busca da API, salva no localStorage, retorna dados frescos.
 * - Offline: retorna dados do localStorage imediatamente (sem erro).
 *
 * Uso idêntico ao useQuery:
 *   const { data, isLoading, isOffline } = useOfflineQuery(
 *     ['chave', parametro],
 *     () => api.get('/rota'),
 *   );
 */
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

function cacheKey(queryKey) {
  const parts = Array.isArray(queryKey) ? queryKey : [queryKey];
  return 'sushi_qcache_' + parts.join('_');
}

function lerCache(key) {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

function salvarCache(key, data) {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify(data));
  } catch { /* localStorage cheio — ignora */ }
}

export function useOfflineQuery(queryKey, queryFn, options = {}) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on  = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Dados do cache local (usados como fallback offline)
  const cachedData = lerCache(queryKey);

  const result = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      salvarCache(queryKey, data);   // sempre atualiza cache ao buscar com sucesso
      return data;
    },
    // Quando offline, usa o cache local como placeholder instantâneo
    placeholderData: isOffline ? cachedData : undefined,
    // Não refetch automático quando offline
    enabled: !isOffline || options.enabled,
    // Não mostrar erro quando offline e temos cache
    retry: isOffline ? false : (options.retry ?? 2),
    ...options,
  });

  // Se offline e temos cache, retorna os dados do cache sem erro
  if (isOffline && cachedData !== undefined) {
    return {
      ...result,
      data: result.data ?? cachedData,
      isLoading: false,
      isError: false,
      isOffline: true,
    };
  }

  return { ...result, isOffline };
}
