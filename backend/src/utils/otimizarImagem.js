// ══════════════════════════════════════════════════════════════
//  Otimização de imagens do cardápio/banners
//
//  Motivo: as fotos vinham do celular/editor e eram gravadas CRUAS
//  (PNG de 1,6 MB, 1024×1024) para serem exibidas num card de 312px.
//  53 fotos = 8,8 MB por visita. Aqui a imagem é redimensionada e
//  convertida para WebP logo após o upload.
//
//  O `sharp` é opcional de propósito (mesmo padrão do multer nas rotas):
//  se não estiver instalado, o upload continua funcionando — só não
//  comprime. Assim um deploy sem `npm install` nunca derruba o PDV.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  console.warn('[imagem] sharp não instalado — fotos serão salvas sem compressão. Rode: npm install sharp');
}

const disponivel = () => sharp !== null;

// Lado maior da imagem final. Os cards exibem a 312px e o hero do modal
// a ~430px de largura; 900px cobre telas 2x sem virar arquivo gigante.
const MAX_LADO = 900;
const QUALIDADE = 78;

// GIF fica de fora: converter perderia a animação.
const IGNORAR = ['.gif'];

/**
 * Comprime a imagem no lugar, trocando-a por um .webp.
 *
 * @param {string} dir       Diretório do arquivo
 * @param {string} arquivo   Nome do arquivo gravado pelo multer
 * @returns {Promise<{arquivo: string, antes: number, depois: number}>}
 *          Em caso de falha ou sharp ausente, devolve o arquivo original
 *          intacto (antes === depois) — nunca lança.
 */
async function otimizar(dir, arquivo) {
  const origem = path.join(dir, arquivo);
  let antes = 0;
  try { antes = fs.statSync(origem).size; } catch { return { arquivo, antes: 0, depois: 0 }; }

  const ext = path.extname(arquivo).toLowerCase();
  if (!sharp || IGNORAR.includes(ext)) return { arquivo, antes, depois: antes };

  const nomeWebp = `${path.basename(arquivo, ext)}.webp`;
  const destino = path.join(dir, nomeWebp);

  try {
    await sharp(origem)
      .rotate() // respeita o EXIF do celular — sem isso a foto sai deitada
      .resize({ width: MAX_LADO, height: MAX_LADO, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE })
      .toFile(destino);

    const depois = fs.statSync(destino).size;

    // Só troca se realmente ficou menor. Uma foto já otimizada pode crescer
    // ao ser reencodada — nesse caso descarta o webp e mantém o original.
    if (depois >= antes) {
      try { fs.unlinkSync(destino); } catch {}
      return { arquivo, antes, depois: antes };
    }

    if (destino !== origem) { try { fs.unlinkSync(origem); } catch {} }
    return { arquivo: nomeWebp, antes, depois };
  } catch (err) {
    console.error('[imagem] falha ao otimizar', arquivo, '—', err.message);
    try { fs.unlinkSync(destino); } catch {}
    return { arquivo, antes, depois: antes };
  }
}

// Versão de ALTA para uso criativo (posts/Stories). 2400px cobre um Story
// 1080×1920 com folga para cortes fechados, sem virar arquivo gigante.
// Vive separada da versão do cardápio: esta prioriza qualidade, aquela peso.
const MAX_LADO_ALTA = 2400;
const QUALIDADE_ALTA = 92;

/**
 * Grava uma cópia em alta resolução ANTES que `otimizar()` destrua o original.
 * Deve ser chamada primeiro — `otimizar()` apaga o arquivo de origem.
 *
 * @param {string} dirOrigem   Diretório onde o multer gravou o arquivo
 * @param {string} arquivo     Nome do arquivo gravado
 * @param {string} dirDestino  Diretório das fotos em alta
 * @returns {Promise<{arquivo:string,largura:number,altura:number}|null>}
 *          null se o sharp não estiver disponível ou em caso de falha.
 *          Nunca lança: falhar a preservação não pode derrubar o upload.
 */
async function preservarAlta(dirOrigem, arquivo, dirDestino) {
  if (!sharp) return null;
  const origem = path.join(dirOrigem, arquivo);
  const ext = path.extname(arquivo).toLowerCase();
  if (IGNORAR.includes(ext)) return null;

  try {
    if (!fs.existsSync(dirDestino)) fs.mkdirSync(dirDestino, { recursive: true });
    const nome = `${path.basename(arquivo, ext)}.webp`;
    const destino = path.join(dirDestino, nome);

    const info = await sharp(origem)
      .rotate() // respeita o EXIF do celular — sem isso a foto sai deitada
      .resize({ width: MAX_LADO_ALTA, height: MAX_LADO_ALTA, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE_ALTA })
      .toFile(destino);

    return { arquivo: nome, largura: info.width, altura: info.height };
  } catch (err) {
    console.error('[imagem] falha ao preservar alta de', arquivo, '—', err.message);
    return null;
  }
}

module.exports = { otimizar, preservarAlta, disponivel, MAX_LADO, QUALIDADE, MAX_LADO_ALTA, QUALIDADE_ALTA };
