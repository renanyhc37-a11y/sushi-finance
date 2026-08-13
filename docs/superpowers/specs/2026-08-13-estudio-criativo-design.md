# Estúdio Criativo Profissional — Design

## O problema

Os posts gerados hoje saem com aparência amadora e "de IA". O dono foi
explícito: quer posts profissionais, com identidade da marca, e que **não
pareçam feitos por IA** — porque o público reage mal a isso.

A investigação mostrou que a arquitetura atual está **certa** e o problema está
em causas específicas e mensuráveis. Vale registrar o que já está bom, para não
ser destruído numa reescrita:

- Templates são JSON declarativo e curado
- A IA **só preenche texto**, nunca desenha layout (é o que evita cara de IA)
- Coordenadas relativas funcionam em 1:1, 4:5 e 9:16
- `maxChars` por campo impede texto estourando a composição

## Diagnóstico — as 5 causas reais

**1. Todos os templates esticam a foto.** Esta é a causa mecânica principal.
As fotos do cardápio têm 600–900px (ver causa 2). As áreas de foto num Story
1080×1920 pedem muito mais:

| Template | Área da foto | Ampliação necessária |
|---|---|---|
| `promo-faixa` | 1080×922 | ~60% |
| `combo-split` | 540×1920 | **~113%** |
| `lancamento-hero` | 1080×1075 | ~20% |

Os três usam `modo: 'cover'`, que força o preenchimento. Ampliação nessa escala
é lida como "amador" em menos de um segundo, antes de o olho avaliar o layout.

**2. As fotos são miniaturas de cardápio.** `backend/src/utils/otimizarImagem.js`
redimensiona para `MAX_LADO = 900`, `QUALIDADE = 78`, WebP, **substituindo o
arquivo original** ("comprime a imagem no lugar"). A decisão foi correta para o
cardápio — 53 fotos cruas custavam 8,8 MB por visita — mas destrói a fonte para
uso criativo. Os originais já enviados **não são recuperáveis**.

**3. As paletas não são a marca.** Seis paletas genéricas (Terroso, Vinho,
Matcha, Oceano, Sakura, Carvão) fazem cada post parecer de uma empresa
diferente. Profissional é o contrário: repetição obstinada da mesma identidade.

**4. A logo não aparece em template nenhum.** Não existe camada para ela. Além
disso `frontend/public/logo.png` é 700×700 **sem canal alpha** — sobre uma foto
formaria um retângulo sólido, um dos sinais mais óbvios de post apressado.
Existe `logo/LOGO_HORIZ (1).pdf` (vetor) que permite exportar em alta com
transparência real.

**5. O texto padrão tem a voz que o dono rejeita.** `CAMPOS_PADRAO` traz
"🔥 Só hoje", "SUSHI PREMIUM", "Fresquinho, feito na hora" — genérico e com
emoji, exatamente o registro que soa a IA.

## Restrição assumida

O dono optou por **trabalhar com as fotos existentes por enquanto**. O design
inteiro parte dessa restrição, e não de fotos futuras.

**Consequência honesta:** dá para entregar posts limpos, editoriais e
consistentes — muito acima do atual. Não dá para entregar aparência de campanha
fotográfica profissional; isso depende de foto nova. O sistema nasce preparado
para receber alta resolução, de modo que subir o nível depois seja só trocar o
arquivo, sem retrabalho.

---

## Peça 1 — Regra de ouro: nunca ampliar

O princípio que resolve a causa nº 1.

**Nenhuma foto é exibida numa área maior que sua resolução real.**

Uma foto 900×900 numa área de 900×900 fica 1:1, perfeitamente nítida. Num
canvas 1080×1920 isso ocupa 83% da largura com margens de 90px — que o olho lê
como **composição editorial intencional**, não como falta de foto.

Para isso, cada foto passa a ter largura e altura conhecidas (Peça 3), e cada
template declara sua área em pixels absolutos por formato. A validação roda
antes da renderização.

**Seleção de template por resolução:** o sistema escolhe o template a partir da
foto disponível — foto grande libera composição hero; foto pequena leva a
composição emoldurada com mais respiro. Assim **nenhum post sai borrado**, mesmo
que o operador não entenda de imagem. É a regra que torna a qualidade um
resultado do sistema e não da disciplina de quem usa.

Quando nenhum template couber, o item cai numa composição só-tipografia com a
cor da marca — que é honesta e bonita — em vez de exibir foto ruim.

## Peça 2 — Kit de Marca

Tabela `marca_config` (linha única, editável em tela):

- **Logo** em três variações, geradas uma vez a partir do PDF vetorial:
  clara, escura, e monocromática — todas PNG com transparência real, 2000px
- **Paleta única da marca**: fundo, destaque, texto, texto suave
- **Tipografia fixa**: uma display + uma de apoio (as atuais Anton/Poppins são
  boas escolhas e serão mantidas)
- **Assinatura**: @ do Instagram e site, aplicados automaticamente

Todo template passa a ter uma camada de logo com posição definida. O dono não
decide identidade post a post — o sistema garante.

As seis paletas genéricas são substituídas pela paleta da marca. Variação
passa a vir da composição e da foto, não de trocar as cores da empresa.

## Peça 3 — Banco de Fotos

Tabela `fotos_banco`:

```sql
CREATE TABLE IF NOT EXISTS fotos_banco (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arquivo TEXT NOT NULL,            -- caminho da versão de alta (criativo)
  arquivo_web TEXT,                 -- versão otimizada (cardápio)
  largura INTEGER NOT NULL,         -- resolução REAL, base da regra de ouro
  altura INTEGER NOT NULL,
  item_id INTEGER,                  -- item do cardápio (opcional)
  hero INTEGER NOT NULL DEFAULT 0,  -- foto principal daquele item
  tags TEXT,                        -- busca livre
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Pipeline de upload passa a gerar duas saídas** em vez de sobrescrever:
o original preservado (até 2400px, qualidade 92) para criativo, e a versão de
900px/q78 atual para o cardápio. O comportamento do cardápio não muda em nada —
nenhuma regressão de peso de página.

As 51 fotos existentes são catalogadas com sua resolução real medida. Elas
continuam servindo, dentro do limite da regra de ouro.

## Peça 4 — Tratamento de imagem

Processamento server-side com `sharp`, que já é dependência do projeto. É o que
extrai o máximo das fotos limitadas:

- **Corte inteligente** — `position: 'attention'` do sharp encontra a região de
  maior saliência. Corte fechado na parte apetitosa usa menos pixels de origem
  para o mesmo impacto, e textura de comida em close vende mais que prato
  inteiro na mesa.
- **Grade de cor da marca** — um leve duotone/tonalização na cor da marca faz
  fotos tiradas em dias e luzes diferentes parecerem **uma campanha só**. É o
  maior ganho isolado de aparência profissional com o acervo atual.
- **Grão sutil** — mascara artefato de compressão WebP e lê como analógico
  editorial. Efeito colateral relevante: imagem de IA é anormalmente lisa, então
  grão é um dos sinais mais fortes de "não foi feito por IA".
- **Nitidez após redimensionar** — máscara de nitidez leve devolve definição
  perdida em qualquer redução.

Cada tratamento é opcional e configurável, com valores padrão conservadores.
Exagero em qualquer um deles produz o efeito oposto ao desejado.

## Peça 5 — Templates editoriais

Substituem os três atuais, construídos sob a regra de ouro. Cada um declara
área de foto em pixels por formato e a resolução mínima que exige.

Princípios codificados (a resposta concreta a "não parecer IA"):

- **Um único recado por post.** Story é visto em 1–2 segundos.
- **Respiro generoso.** Amador preenche todo o espaço; profissional deixa vazio.
  Margem mínima de 8% em todos os lados.
- **Máximo duas fontes**, com contraste forte de tamanho fazendo a hierarquia.
- **Nunca tudo centralizado.** Alinhamento à esquerda com uma âncora clara.
- **Zero emoji** nos textos padrão. Emoji entra só se o dono escrever.
- **Sem gradiente colorido decorativo** e sem elemento em cada canto.
- **Área segura do Stories:** os 250px de topo e 250px de base do Instagram são
  cobertos pela interface do app. Nenhum texto ou preço entra ali — erro comum
  que faz o post parecer feito por quem não posta.

## Peça 6 — A voz do texto

`CAMPOS_PADRAO` é reescrito para a voz da casa, sem emoji e sem superlativo
vazio. O prompt da IA que preenche os textos ganha regras explícitas:

- Nada de "imperdível", "confira", "delícia", "sabor incomparável"
- Frase curta, concreta, com substantivo forte
- O nome real do prato tem precedência sobre adjetivo
- Respeitar `maxChars` (hoje a IA às vezes estoura — corrigido aqui)

## Fora de escopo

- **Publicação automática no Instagram** — exige app aprovado na Meta e conta
  business verificada.
- **Geração de imagem por IA** — descartado por decisão de produto: é
  exatamente o que o público identifica e rejeita, e comida gerada por IA não
  corresponde ao prato entregue.
- **Recuperar a resolução das fotos já enviadas** — impossível, o original foi
  sobrescrito. Só uma foto nova resolve.
- **Vídeo / Reels** — outro projeto.

## Testes

- **Unitários** para a regra de ouro: dada uma foto de X×Y e um template,
  confirmar que a área nunca excede a origem, e que a seleção por resolução
  escolhe a composição correta (inclusive o caso "nenhum template cabe →
  só-tipografia").
- **Unitários** para o pipeline de upload: confirmar que gera **as duas** saídas
  e que a versão do cardápio permanece com as dimensões e o peso de hoje
  (proteção contra regressão de performance).
- **Verificação visual** obrigatória: gerar um Story com uma foto real do
  cardápio em cada template novo e conferir nitidez, área segura e aplicação da
  marca antes de considerar pronto.
