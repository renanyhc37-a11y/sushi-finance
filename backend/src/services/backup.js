// ──────────────────────────────────────────────────────────────
//  Backup automático do banco de dados
//  - Faz uma cópia ao iniciar o servidor e depois 1x por dia
//  - Mantém os últimos N backups (apaga os mais antigos)
//  - Usa cópia simples do arquivo .db (node:sqlite roda em modo
//    síncrono, então não há escrita concorrente durante a cópia)
// ──────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'sushi.db');
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
const MANTER = 14;                       // quantos backups guardar
const INTERVALO_MS = 24 * 60 * 60 * 1000; // 1 dia

// Fotos em alta são insubstituíveis (o original só existe aqui) e não cabem
// no .db. Espelha incrementalmente: copia só o que ainda não foi copiado.
function espelharFotos() {
  let copiadas = 0;
  try {
    const { ALTA_DIR } = require('./bancoFotos');
    if (!fs.existsSync(ALTA_DIR)) return { copiadas };
    const destino = path.join(BACKUP_DIR, 'fotos');
    if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });

    for (const nome of fs.readdirSync(ALTA_DIR)) {
      const alvo = path.join(destino, nome);
      if (fs.existsSync(alvo)) continue;
      try { fs.copyFileSync(path.join(ALTA_DIR, nome), alvo); copiadas++; } catch {}
    }
    if (copiadas > 0) console.log(`[backup] ${copiadas} foto(s) nova(s) copiada(s)`);
  } catch (err) {
    console.error('[backup] Falha ao espelhar fotos:', err.message);
  }
  return { copiadas };
}

function fazerBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // Integra o WAL ao arquivo principal antes de copiar — garante que o
    // backup contém TODAS as escritas (inclusive as mais recentes).
    try { db.checkpoint?.(); } catch {}

    const carimbo = new Date().toISOString().slice(0, 10); // AAAA-MM-DD
    const destino = path.join(BACKUP_DIR, `sushi-${carimbo}.db`);
    fs.copyFileSync(DB_PATH, destino);
    console.log(`[backup] Banco salvo em ${destino}`);

    espelharFotos();

    // Remove backups antigos, mantendo os mais recentes
    const arquivos = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('sushi-') && f.endsWith('.db'))
      .sort(); // ordem alfabética = ordem cronológica (AAAA-MM-DD)
    while (arquivos.length > MANTER) {
      const velho = arquivos.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, velho)); } catch (_) {}
    }
  } catch (err) {
    console.error('[backup] Falha ao fazer backup:', err.message);
  }
}

function iniciarBackupAutomatico() {
  fazerBackup(); // um logo ao subir o servidor
  const t = setInterval(fazerBackup, INTERVALO_MS);
  t.unref?.(); // não impede o processo de encerrar
  console.log('[backup] Backup automático ativado (diário, mantém últimos', MANTER, 'dias)');
}

module.exports = { iniciarBackupAutomatico, fazerBackup, espelharFotos };
