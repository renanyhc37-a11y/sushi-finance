// Onboarding do Sushi NinjaControl.
//
// Filosofia: pegar na mão do dono sem ser chato. Um tour curto que dá pra pular,
// e uma "dica do ninja" no topo das telas-chave que some quando ele fecha (e não
// volta a encher o saco). Voz desenrolada, de balcão, de dono pra dono — a gíria
// fica no ritmo, não forçada.

const PREFIXO = 'njc:onb:';

// ── Estado (localStorage) ────────────────────────────────────────
export function tourVisto() {
  return localStorage.getItem(`${PREFIXO}tour`) === 'ok';
}
export function marcarTourVisto() {
  localStorage.setItem(`${PREFIXO}tour`, 'ok');
}
export function dicaOculta(id) {
  return localStorage.getItem(`${PREFIXO}dica:${id}`) === 'ok';
}
export function ocultarDica(id) {
  localStorage.setItem(`${PREFIXO}dica:${id}`, 'ok');
}
// Reabre tudo (usado no botão "rever tour" / "reativar dicas").
export function resetarOnboarding() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIXO))
    .forEach(k => localStorage.removeItem(k));
}

// ── Passos do tour de boas-vindas ────────────────────────────────
export const PASSOS_TOUR = [
  {
    emoji: '🥷',
    titulo: 'Firmeza, chef!',
    texto:
      'Esse é o seu balcão digital. Em uns 30 segundos eu te mostro onde tá o ouro. ' +
      'Se preferir fuçar sozinho, é só pular — o ninja não se ofende.',
  },
  {
    emoji: '🍣',
    titulo: 'Seu cardápio já veio montado',
    texto:
      'Uramaki, hot, temaki, combinado, bebida, sobremesa… os clássicos que todo delivery ' +
      'vende já tão aqui, com ficha técnica e tudo. Você não começa do zero.',
  },
  {
    emoji: '💰',
    titulo: 'O CMV se vira sozinho',
    texto:
      'Passa em Ingredientes e bota o preço que VOCÊ paga no salmão, no cream cheese, na alga. ' +
      'O custo de cada prato e o CMV se recalculam na hora. Ajusta a raiz, o resto se resolve.',
  },
  {
    emoji: '📈',
    titulo: 'Joga o faturamento e vê a mágica',
    texto:
      'Tem planilha do iFood ou Rappi? Sobe em "Importar (IA)" que eu leio pra você e monto o painel. ' +
      'Aí dá pra enxergar, sem achismo, quanto entra, quanto sai e quanto sobra.',
  },
];

// ── Dicas por página ─────────────────────────────────────────────
// id = chave de localStorage. Use <DicaNinja id="fichas" /> na página.
export const DICAS = {
  'dashboard-central': {
    titulo: 'Seu resumo do dia, sem enrolação',
    texto:
      'Entrou, saiu, sobrou — é isso que importa. Quanto mais você alimenta (faturamento + custos), ' +
      'mais afiado esse painel fica. Comece ajustando seus ingredientes e importando um faturamento.',
  },
  ingredientes: {
    titulo: 'Aqui é a raiz de tudo',
    texto:
      'Bota o preço REAL que você paga em cada item. É o único lugar que você precisa mexer de verdade — ' +
      'o custo dos pratos e o CMV se ajustam sozinhos a partir daqui.',
  },
  fichas: {
    titulo: 'A receita de cada prato',
    texto:
      'Cada item mostra o que vai dentro e quanto custa fazer. Mexeu no preço de um ingrediente? ' +
      'O CMV de todo prato que usa ele muda junto. Confere se os recheios batem com os seus.',
  },
  'cmv-produtos': {
    titulo: 'CMV é o termômetro do lucro',
    texto:
      'É quanto do preço de venda vira custo de ingrediente. Sushi saudável fica lá pelos 30%. ' +
      'Passou de 35%? Ou o preço tá baixo, ou a mão tá pesada demais no recheio.',
  },
  'importar-faturamento': {
    titulo: 'Deixa a IA digitar por você',
    texto:
      'Sobe a planilha do iFood, Rappi ou do seu PDV que eu leio e lanço o faturamento pra você. ' +
      'Não precisa cadastrar dia por dia na unha.',
  },
  despesas: {
    titulo: 'O que separa "vendi muito" de "sobrou dinheiro"',
    texto:
      'Aluguel, luz, funcionário, embalagem, taxa do app… tudo que sai entra aqui. ' +
      'Sem as despesas, o lucro é só ilusão. Lança os fixos uma vez e marca como recorrente.',
  },
  fornecedores: {
    titulo: 'Onde tá mais barato?',
    texto:
      'Cadastra seus fornecedores, lança o preço de cada item em cada um, e o sistema marca o mais ' +
      'barato com um 🏆. Dá pra montar o pedido e mandar direto no WhatsApp do fornecedor.',
  },
  faturamento: {
    titulo: 'Quanto entrou hoje',
    texto:
      'Lança o total do dia por forma de pagamento (pix, cartão, dinheiro). ' +
      'Se tiver planilha, usa o "Importar (IA)" que é bem mais rápido.',
  },
};

// Dicas gerais — entram no carrossel de TODA página, depois da dica específica.
// É o que dá o "arrasta pro lado pra ver as outras dicas".
export const DICAS_GERAIS = [
  {
    titulo: 'Sem preço, sem verdade',
    texto:
      'Ingrediente sem custo faz o CMV sair zerado. Passa em Ingredientes e bota o que você ' +
      'paga de verdade — uns 5 minutos e o sistema inteiro fica afiado.',
  },
  {
    titulo: 'Tudo se arrasta',
    texto:
      'Qualquer tela rola arrastando com o dedo (ou segurando o mouse). E a barra de atalhos lá ' +
      'em cima também arrasta pro lado — dá pra alcançar personalização, tema e o resto.',
  },
  {
    titulo: 'Alimenta que ele te paga',
    texto:
      'Quanto mais você lança (faturamento + despesas + fichas), mais o painel vira um raio-X do ' +
      'seu lucro. Poucos minutos por dia e você para de decidir no achismo.',
  },
  {
    titulo: 'Tá tudo editável',
    texto:
      'Nada aqui é escrito na pedra. Preço, ficha, ingrediente… mexe à vontade. ' +
      'O catálogo que já veio pronto é só um pontapé pra você não começar do zero.',
  },
];

// Monta a lista de dicas de uma página: a específica (se houver) + as gerais.
export function dicasDaPagina(id) {
  const esp = DICAS[id];
  const base = esp ? (Array.isArray(esp) ? esp : [esp]) : [];
  return [...base, ...DICAS_GERAIS];
}
