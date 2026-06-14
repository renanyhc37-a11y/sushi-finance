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

module.exports = { iniciarBackupAutomatico, fazerBackup };
