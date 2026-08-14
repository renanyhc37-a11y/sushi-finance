// ══════════════════════════════════════════════════════════════
//  Banco de fotos — catálogo das imagens disponíveis para criação
//
//  A coluna largura/altura guarda a resolução REAL do arquivo em alta.
//  É esse dado que sustenta a "regra de ouro" do Estúdio Criativo:
//  nunca exibir uma foto numa área maior do que ela tem — ampliar é o
//  que faz um post parecer amador.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

let sharp = null;
try { sharp = require('sharp'); } catch { /* sem sharp, catalogação fica indisponível */ }

const ALTA_DIR = path.join(__dirname, '..', '..', 'uploads', 'fotos');
const WEB_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'cardapio');

// A coluna largura/altura deve sempre guardar a MAIOR resolução já vista pra
// esse arquivo, não a última gravada — o catálogo alta-resolução e o web
// (900px) usam o mesmo nome de arquivo e podem ser catalogados em qualquer
// ordem, então o upsert compara por área (largura × altura) e mantém a maior,
// independente de qual passada rodou primeiro. arquivo_web é sempre gravado
// quando informado, mesmo quando ele não vence a comparação de resolução —
// é o caminho usado pelo cardápio e precisa sobreviver mesmo que a foto em
// alta já esteja catalogada.
function registrarFoto({ arquivo, arquivo_web = null, largura = 0, altura = 0, item_id = null, hero = 0, tags = null }) {
  // RETURNING funciona no driver node:sqlite (verificado empiricamente) e
  // devolve sempre o id da linha realmente afetada — inclusive no ramo
  // DO UPDATE, onde lastInsertRowid ficaria com o id de outra linha (só é
  // atualizado em INSERT real).
  const row = db.prepare(`
    INSERT INTO fotos_banco (arquivo, arquivo_web, largura, altura, item_id, hero, tags)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(arquivo) DO UPDATE SET
      largura = CASE
        WHEN (excluded.largura * excluded.altura) > (fotos_banco.largura * fotos_banco.altura)
        THEN excluded.largura ELSE fotos_banco.largura END,
      altura = CASE
        WHEN (excluded.largura * excluded.altura) > (fotos_banco.largura * fotos_banco.altura)
        THEN excluded.altura ELSE fotos_banco.altura END,
      arquivo_web = COALESCE(excluded.arquivo_web, fotos_banco.arquivo_web)
    RETURNING id
  `).get(arquivo, arquivo_web, largura, altura, item_id, hero ? 1 : 0, tags);
  return { id: row.id };
}

function listarFotos({ item_id = null, apenasHero = false } = {}) {
  let q = 'SELECT * FROM fotos_banco WHERE 1=1';
  const p = [];
  if (item_id) { q += ' AND item_id = ?'; p.push(item_id); }
  if (apenasHero) q += ' AND hero = 1';
  q += ' ORDER BY hero DESC, id DESC';
  return db.prepare(q).all(...p);
}

// A regra de ouro: só serve se a foto cobre a área sem precisar ampliar.
function resolucaoSuficiente(foto, larguraAlvo, alturaAlvo) {
  if (!foto) return false;
  const l = Number(foto.largura || 0);
  const a = Number(foto.altura || 0);
  if (l <= 0 || a <= 0) return false;
  return l >= larguraAlvo && a >= alturaAlvo;
}

// Cataloga o acervo que já existe no disco. As fotos antigas só têm a versão
// web de 900px (o original foi destruído pelo otimizador antigo) — elas são
// registradas com a resolução real que têm, e a regra de ouro cuida do resto.
async function catalogarExistentes() {
  if (!sharp) return { inseridas: 0, ignoradas: 0 };
  let inseridas = 0, ignoradas = 0;

  const varrer = async (dir, ehAlta) => {
    if (!fs.existsSync(dir)) return;
    for (const nome of fs.readdirSync(dir)) {
      if (!/\.(webp|jpe?g|png)$/i.test(nome)) { ignoradas++; continue; }
      try {
        const meta = await sharp(path.join(dir, nome)).metadata();
        const item = db.prepare('SELECT id FROM cardapio_itens WHERE foto = ?').get(`/cardapio/${nome}`);
        registrarFoto({
          arquivo: nome,
          arquivo_web: ehAlta ? null : `/cardapio/${nome}`,
          largura: meta.width || 0,
          altura: meta.height || 0,
          item_id: item?.id || null,
          hero: item ? 1 : 0,
        });
        inseridas++;
      } catch { ignoradas++; }
    }
  };

  await varrer(ALTA_DIR, true);
  await varrer(WEB_DIR, false);
  return { inseridas, ignoradas };
}

module.exports = { registrarFoto, listarFotos, resolucaoSuficiente, catalogarExistentes, ALTA_DIR, WEB_DIR };
