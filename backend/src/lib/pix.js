// Gera o "copia e cola" do Pix (BR Code / EMV QRCPS-MPM) a partir da chave do
// recebedor — sem gateway e sem custo. Segue o padrão do Banco Central.

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

const limpar = (s, max) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acentos
  .replace(/[^\x20-\x7E]/g, '')                       // só ASCII imprimível
  .toUpperCase().slice(0, max).trim();

// { chave, nome, cidade, valor, txid }
function gerarPixPayload({ chave, nome, cidade, valor, txid }) {
  if (!chave) return null;
  const mai = campo('00', 'br.gov.bcb.pix') + campo('01', String(chave).trim());
  const valorStr = (valor != null && Number(valor) > 0) ? Number(valor).toFixed(2) : null;
  const tx = (txid || '***').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';

  let p = '';
  p += campo('00', '01');                       // Payload Format Indicator
  p += campo('26', mai);                         // Merchant Account Info (Pix)
  p += campo('52', '0000');                      // Merchant Category Code
  p += campo('53', '986');                       // Moeda: BRL
  if (valorStr) p += campo('54', valorStr);      // Valor
  p += campo('58', 'BR');                        // País
  p += campo('59', limpar(nome, 25) || 'RECEBEDOR');
  p += campo('60', limpar(cidade, 15) || 'CIDADE');
  p += campo('62', campo('05', tx));             // Additional data (txid)
  p += '6304';                                   // CRC placeholder
  p += crc16(p);
  return p;
}

module.exports = { gerarPixPayload };
