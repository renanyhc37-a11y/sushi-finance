import React from 'react';

export default function ConfirmDialog({ titulo, mensagem, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xl">
            🗑️
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">{titulo}</h3>
            <p className="text-sm text-slate-500">{mensagem}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
