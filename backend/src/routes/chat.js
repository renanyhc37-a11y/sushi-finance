const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const wa = require('../services/whatsapp');

const router = Router();

// GET /api/chat/conversas
router.get('/conversas', (req, res) => {
  const { arquivadas = '0', busca = '' } = req.query;
  const rows = db.prepare(`
    SELECT c.*, COUNT(m.id) FILTER (WHERE m.lida=0 AND m.de_mim=0) as nao_lidas
    FROM wa_conversas c
    LEFT JOIN wa_mensagens m ON m.conversa_id = c.id
    WHERE c.arquivada = ?
      AND (c.nome LIKE ? OR c.telefone LIKE ?)
    GROUP BY c.id
    ORDER BY c.ultima_em DESC
  `).all(arquivadas === '1' ? 1 : 0, `%${busca}%`, `%${busca}%`);
  res.json(rows);
});

// GET /api/chat/conversas/:id/mensagens
router.get('/conversas/:id/mensagens', (req, res) => {
  const msgs = db.prepare(`
    SELECT * FROM wa_mensagens WHERE conversa_id=? ORDER BY created_at ASC
  `).all(req.params.id);

  // Marca como lidas
  db.prepare('UPDATE wa_mensagens SET lida=1 WHERE conversa_id=? AND de_mim=0')
    .run(req.params.id);
  db.prepare('UPDATE wa_conversas SET nao_lidas=0 WHERE id=?')
    .run(req.params.id);

  res.json(msgs);
});

// POST /api/chat/conversas/:id/responder
router.post('/conversas/:id/responder', async (req, res) => {
  const { corpo } = req.body;
  if (!corpo?.trim()) return res.status(400).json({ erro: 'Mensagem vazia' });

  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE id=?').get(req.params.id);
  if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

  try {
    await wa.enviarEsalvar(conversa, corpo.trim(), false);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/chat/conversas/:id/ia-sugerir
router.post('/conversas/:id/ia-sugerir', async (req, res) => {
  const { mensagem_cliente } = req.body;
  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE id=?').get(req.params.id);
  if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

  try {
    const cfg = db.prepare('SELECT * FROM wa_config WHERE id=1').get();
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const historico = db.prepare(`
      SELECT corpo, de_mim FROM wa_mensagens
      WHERE conversa_id=? ORDER BY created_at DESC LIMIT 8
    `).all(conversa.id).reverse();

    let cardapioCtx = '';
    try {
      const itens = db.prepare('SELECT nome, preco FROM cardapio_itens WHERE ativo=1 LIMIT 20').all();
      cardapioCtx = `\nCardápio: ${itens.map(i => `${i.nome} R$${Number(i.preco).toFixed(2)}`).join(', ')}`;
    } catch {}

    const system = cfg?.prompt_sistema || `Você é assistente de um restaurante de sushi. Sugira UMA resposta curta, simpática e útil para o cliente. Responda em português. Use emojis moderadamente.${cardapioCtx}`;

    const resp = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system,
      messages: (() => {
        // Remove vazios e mescla consecutivos do mesmo papel
        const raw = historico
          .map(m => ({ role: m.de_mim ? 'assistant' : 'user', content: (m.corpo || '').trim() }))
          .filter(m => m.content.length > 0);
        const merged = [];
        for (const msg of raw) {
          const last = merged[merged.length - 1];
          if (last && last.role === msg.role) last.content += '\n' + msg.content;
          else merged.push({ ...msg });
        }
        // Remove user messages do fim (vamos adicionar a mensagem atual)
        while (merged.length > 0 && merged[merged.length - 1].role === 'user') merged.pop();
        return [...merged, { role: 'user', content: (mensagem_cliente || 'Olá').trim() || 'Olá' }];
      })(),
    });

    const uso = resp.usage;
    // Opus: $5/M input, $25/M output
    const custo = ((uso.input_tokens||0) * 0.000005 + (uso.output_tokens||0) * 0.000025);
    console.log(`[IA-Sugerir] tokens: ${uso.input_tokens}in ${uso.output_tokens}out | custo: $${custo.toFixed(6)}`);

    res.json({ sugestao: resp.content[0]?.text || '' });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// PATCH /api/chat/conversas/:id
router.patch('/conversas/:id', (req, res) => {
  const { ia_ativa, arquivada, nome, tags, assumida } = req.body;
  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE id=?').get(req.params.id);
  if (!conversa) return res.status(404).json({ erro: 'Não encontrada' });

  if (ia_ativa !== undefined) db.prepare('UPDATE wa_conversas SET ia_ativa=? WHERE id=?').run(ia_ativa ? 1 : 0, conversa.id);
  if (arquivada !== undefined) db.prepare('UPDATE wa_conversas SET arquivada=? WHERE id=?').run(arquivada ? 1 : 0, conversa.id);
  if (nome !== undefined) db.prepare('UPDATE wa_conversas SET nome=? WHERE id=?').run(nome, conversa.id);
  if (tags !== undefined) db.prepare('UPDATE wa_conversas SET tags=? WHERE id=?').run(JSON.stringify(tags), conversa.id);
  if (assumida !== undefined) db.prepare('UPDATE wa_conversas SET assumida=?, assumida_em=datetime(\'now\'), ia_ativa=? WHERE id=?').run(assumida ? 1 : 0, assumida ? 0 : 1, conversa.id);

  res.json(db.prepare('SELECT * FROM wa_conversas WHERE id=?').get(conversa.id));
});

// GET /api/chat/conversas/:id/pedidos — histórico de pedidos do cliente
router.get('/conversas/:id/pedidos', (req, res) => {
  const conv = db.prepare('SELECT * FROM wa_conversas WHERE id=?').get(req.params.id);
  if (!conv) return res.json([]);
  const tel = conv.telefone.replace(/\D/g,'');
  try {
    const pedidos = db.prepare(`
      SELECT p.id, p.numero, p.status, p.total, p.created_at,
             GROUP_CONCAT(pi.quantidade || 'x ' || pi.item_nome, ', ') as itens
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
      WHERE REPLACE(REPLACE(p.cliente_telefone,'-',''),' ','') LIKE ?
      GROUP BY p.id ORDER BY p.created_at DESC LIMIT 10
    `).all(`%${tel.slice(-8)}%`);
    res.json(pedidos);
  } catch { res.json([]); }
});

// GET /api/chat/metricas
router.get('/metricas', (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0,10);
    const semana = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10);
    const respondidas_ia_hoje = db.prepare("SELECT COUNT(*) as n FROM wa_mensagens WHERE ia=1 AND date(created_at)=?").get(hoje).n;
    const respondidas_ia_semana = db.prepare("SELECT COUNT(*) as n FROM wa_mensagens WHERE ia=1 AND date(created_at)>=?").get(semana).n;
    // Estimativa de custo: Haiku ~$0.0004 por resposta automática (avg 400 tokens)
    const custoEstimadoHoje = respondidas_ia_hoje * 0.0004;
    const diasComDados = db.prepare("SELECT COUNT(DISTINCT date(created_at)) as n FROM wa_mensagens WHERE ia=1 AND date(created_at)>=?").get(semana).n || 1;
    const mediaIaPorDia = respondidas_ia_semana / diasComDados;
    const custoEstimadoMensal = mediaIaPorDia * 30 * 0.0004;
    const brlRate = 5.5; // USD to BRL approximate
    const metricas = {
      total_conversas: db.prepare('SELECT COUNT(*) as n FROM wa_conversas').get().n,
      conversas_hoje: db.prepare("SELECT COUNT(*) as n FROM wa_conversas WHERE date(ultima_em)=?").get(hoje).n,
      mensagens_hoje: db.prepare("SELECT COUNT(*) as n FROM wa_mensagens WHERE date(created_at)=?").get(hoje).n,
      respondidas_ia_hoje,
      nao_lidas_total: db.prepare('SELECT SUM(nao_lidas) as n FROM wa_conversas WHERE arquivada=0').get().n || 0,
      mensagens_semana: db.prepare("SELECT COUNT(*) as n FROM wa_mensagens WHERE date(created_at)>=?").get(semana).n,
      respondidas_ia_semana,
      custo_estimado_hoje_usd: custoEstimadoHoje,
      custo_estimado_mensal_usd: custoEstimadoMensal,
      custo_estimado_mensal_brl: custoEstimadoMensal * brlRate,
      media_ia_por_dia: mediaIaPorDia,
      por_dia: db.prepare(`
        SELECT date(created_at) as dia, COUNT(*) as total,
               SUM(CASE WHEN ia=1 THEN 1 ELSE 0 END) as ia
        FROM wa_mensagens WHERE date(created_at)>=? GROUP BY dia ORDER BY dia
      `).all(semana),
    };
    res.json(metricas);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /api/chat/conversas/:id
router.delete('/conversas/:id', (req, res) => {
  db.prepare('DELETE FROM wa_conversas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/chat/config
router.get('/config', (req, res) => {
  res.json(db.prepare('SELECT * FROM wa_config WHERE id=1').get() || {});
});

// PUT /api/chat/config
router.put('/config', (req, res) => {
  const { ia_global, prompt_sistema, horario_atendimento, mensagem_fora_horario, mensagem_boas_vindas } = req.body;
  db.prepare(`
    UPDATE wa_config SET
      ia_global = COALESCE(?, ia_global),
      prompt_sistema = COALESCE(?, prompt_sistema),
      horario_atendimento = COALESCE(?, horario_atendimento),
      mensagem_fora_horario = COALESCE(?, mensagem_fora_horario),
      mensagem_boas_vindas = COALESCE(?, mensagem_boas_vindas)
    WHERE id=1
  `).run(ia_global ?? null, prompt_sistema ?? null, horario_atendimento ?? null, mensagem_fora_horario ?? null, mensagem_boas_vindas ?? null);
  res.json(db.prepare('SELECT * FROM wa_config WHERE id=1').get());
});

// POST /api/chat/simular
router.post('/simular', async (req, res) => {
  const { telefone = 'TESTE_11999999999', nome = 'Cliente Teste', corpo = 'Olá, quais são os preços?' } = req.body;
  await wa.receberMensagem({ telefone: telefone.startsWith('TESTE_') ? telefone : `TESTE_${telefone}`, nome, corpo, waId: null });
  res.json({ ok: true });
});

// ── Respostas rápidas ─────────────────────────────────────────
router.get('/respostas-rapidas', (req, res) => {
  res.json(db.prepare('SELECT * FROM wa_respostas_rapidas ORDER BY titulo').all());
});
router.post('/respostas-rapidas', (req, res) => {
  const { titulo, corpo, atalho } = req.body;
  if (!titulo?.trim() || !corpo?.trim()) return res.status(400).json({ erro: 'Título e corpo obrigatórios' });
  const r = db.prepare('INSERT INTO wa_respostas_rapidas(titulo,corpo,atalho) VALUES(?,?,?)').run(titulo.trim(), corpo.trim(), atalho?.trim()||null);
  res.json(db.prepare('SELECT * FROM wa_respostas_rapidas WHERE id=?').get(r.lastInsertRowid));
});
router.put('/respostas-rapidas/:id', (req, res) => {
  const { titulo, corpo, atalho } = req.body;
  db.prepare('UPDATE wa_respostas_rapidas SET titulo=?,corpo=?,atalho=? WHERE id=?').run(titulo,corpo,atalho||null,req.params.id);
  res.json(db.prepare('SELECT * FROM wa_respostas_rapidas WHERE id=?').get(req.params.id));
});
router.delete('/respostas-rapidas/:id', (req, res) => {
  db.prepare('DELETE FROM wa_respostas_rapidas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Broadcast ─────────────────────────────────────────────────
router.post('/broadcast', async (req, res) => {
  const { titulo, corpo, filtro = 'ativos_semana', limite = 80 } = req.body;
  if (!corpo?.trim()) return res.status(400).json({ erro: 'Mensagem obrigatória' });

  const limiteNum = Math.min(Math.max(parseInt(limite) || 80, 1), 200);

  let conversas = [];
  if (filtro === 'todos') conversas = db.prepare("SELECT * FROM wa_conversas WHERE arquivada=0 AND telefone NOT LIKE 'TESTE_%' LIMIT ?").all(limiteNum);
  else if (filtro === 'ativos_semana') conversas = db.prepare("SELECT * FROM wa_conversas WHERE arquivada=0 AND ultima_em >= datetime('now','-7 days') AND telefone NOT LIKE 'TESTE_%' LIMIT ?").all(limiteNum);
  else if (filtro === 'ativos_mes') conversas = db.prepare("SELECT * FROM wa_conversas WHERE arquivada=0 AND ultima_em >= datetime('now','-30 days') AND telefone NOT LIKE 'TESTE_%' LIMIT ?").all(limiteNum);

  const row = db.prepare('INSERT INTO wa_broadcasts(titulo,corpo,total,status) VALUES(?,?,?,?)').run(titulo||'Broadcast', corpo, conversas.length, 'enviando');
  const broadcastId = row.lastInsertRowid;

  res.json({ ok: true, id: broadcastId, total: conversas.length });

  // Envia em background com delay aleatório (3–8s) para parecer mais humano
  (async () => {
    let enviados = 0;
    for (const conv of conversas) {
      try {
        // Personaliza {nome} com o nome real do contato
        const nomeContato = (conv.nome || '').split(' ')[0] || 'cliente';
        const mensagemPersonalizada = corpo.replace(/\{nome\}/gi, nomeContato);

        await wa.enviarEsalvar(conv, mensagemPersonalizada, false);
        enviados++;
        db.prepare('UPDATE wa_broadcasts SET enviados=? WHERE id=?').run(enviados, broadcastId);
      } catch {}

      // Delay aleatório entre 3s e 8s entre cada envio
      const delay = 3000 + Math.floor(Math.random() * 5000);
      await new Promise(r => setTimeout(r, delay));
    }
    db.prepare("UPDATE wa_broadcasts SET status='concluido' WHERE id=?").run(broadcastId);
  })();
});

router.get('/broadcasts', (req, res) => {
  res.json(db.prepare('SELECT * FROM wa_broadcasts ORDER BY created_at DESC LIMIT 20').all());
});

// ── Treinamento ───────────────────────────────────────────────
router.get('/exemplos', (req, res) => {
  const { categoria } = req.query;
  const rows = categoria
    ? db.prepare('SELECT * FROM wa_exemplos WHERE categoria=? ORDER BY created_at DESC').all(categoria)
    : db.prepare('SELECT * FROM wa_exemplos ORDER BY categoria, created_at DESC').all();
  res.json(rows);
});

router.post('/exemplos', (req, res) => {
  const { categoria = 'geral', pergunta, resposta } = req.body;
  if (!pergunta?.trim() || !resposta?.trim()) return res.status(400).json({ erro: 'Pergunta e resposta obrigatórias' });
  const r = db.prepare('INSERT INTO wa_exemplos(categoria,pergunta,resposta) VALUES(?,?,?)').run(categoria, pergunta.trim(), resposta.trim());
  res.json(db.prepare('SELECT * FROM wa_exemplos WHERE id=?').get(r.lastInsertRowid));
});

router.put('/exemplos/:id', (req, res) => {
  const { categoria, pergunta, resposta, ativo } = req.body;
  db.prepare('UPDATE wa_exemplos SET categoria=COALESCE(?,categoria), pergunta=COALESCE(?,pergunta), resposta=COALESCE(?,resposta), ativo=COALESCE(?,ativo) WHERE id=?')
    .run(categoria??null, pergunta??null, resposta??null, ativo??null, req.params.id);
  res.json(db.prepare('SELECT * FROM wa_exemplos WHERE id=?').get(req.params.id));
});

router.delete('/exemplos/:id', (req, res) => {
  db.prepare('DELETE FROM wa_exemplos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/chat/media/:filename — serve arquivos de mídia recebidos via WhatsApp
router.get('/media/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // previne path traversal
  const filepath = path.join(__dirname, '..', '..', 'uploads', 'wa-media', filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
  res.sendFile(filepath);
});

module.exports = router;
