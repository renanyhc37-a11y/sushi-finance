import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

export function exportarRelatorioPDF({ dre, evolucao, mes }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ORANGE = [249, 115, 22];
  const DARK   = [15, 15, 15];
  const GRAY   = [100, 100, 100];
  const W = 210;

  // ── Cabeçalho ──
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 30, 'F');

  doc.setFillColor(...ORANGE);
  doc.rect(0, 28, W, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SUSHI CONTROL', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('Sistema Financeiro', 14, 21);

  doc.setTextColor(...ORANGE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const mesLabel = mes ? new Date(mes + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
  doc.text(mesLabel.toUpperCase(), W - 14, 14, { align: 'right' });

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - 14, 21, { align: 'right' });

  let y = 38;

  // ── DRE ──
  if (dre) {
    doc.setTextColor(...ORANGE);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DRE — Demonstrativo de Resultado', 14, y);
    y += 8;

    const dreRows = [
      ['(+) Faturamento Bruto',    brl(dre.faturamento_bruto),    false],
      ['(-) Taxas de Cartão',       brl(-(dre.taxa_cartao || 0)),  true],
      ['= Faturamento Líquido',     brl(dre.faturamento_liquido),  false],
      ['(-) Despesas Fixas',        brl(-dre.despesas_fixas),      true],
      ['(-) Despesas Variáveis',    brl(-dre.despesas_variaveis),  true],
      ['= Lucro Líquido',           brl(dre.lucro_liquido),        false],
    ];

    autoTable(doc, {
      startY: y,
      head: [['Descrição', 'Valor']],
      body: dreRows.map(([label, valor]) => [label, valor]),
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4, font: 'helvetica' },
      headStyles: { fillColor: ORANGE, textColor: [255,255,255], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.row.index === 5) { // Lucro líquido
          const v = dre.lucro_liquido;
          data.cell.styles.textColor = v >= 0 ? [16, 185, 129] : [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.row.index === 2) {
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 8;

    // Margem líquida
    if (dre.faturamento_bruto > 0) {
      const margem = (dre.lucro_liquido / dre.faturamento_bruto) * 100;
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(`Margem líquida: ${pct(margem)}`, 14, y);
      y += 10;
    }

    // Formas de pagamento
    if (dre.pagamentos) {
      doc.setTextColor(...ORANGE);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Formas de Pagamento', 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['PIX', 'Dinheiro', 'Crédito', 'Débito']],
        body: [[
          brl(dre.pagamentos.pix),
          brl(dre.pagamentos.dinheiro),
          brl(dre.pagamentos.credito),
          brl(dre.pagamentos.debito),
        ]],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
        headStyles: { fillColor: [30, 30, 30], textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 12;
    }
  }

  // ── Histórico Mensal ──
  if (evolucao && evolucao.length > 0) {
    // Nova página se necessário
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setTextColor(...ORANGE);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Histórico Mensal', 14, y);
    y += 8;

    const meses = [...evolucao].reverse();
    autoTable(doc, {
      startY: y,
      head: [['Mês', 'Faturamento', 'Liq. s/ Despesas', 'Lucro Líquido', 'Margem']],
      body: meses.map(e => {
        const label = new Date(e.mes + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const margem = e.faturamento_bruto > 0 ? (e.lucro_liquido / e.faturamento_bruto) * 100 : 0;
        return [label.toUpperCase(), brl(e.faturamento_bruto), brl(e.lucro_bruto), brl(e.lucro_liquido), pct(margem)];
      }),
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: ORANGE, textColor: [255,255,255], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const row = meses[data.row.index];
          if (row) data.cell.styles.textColor = row.lucro_liquido >= 0 ? [16,185,129] : [239,68,68];
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Rodapé ──
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, 285, W, 12, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Sushi Control — Sistema Financeiro', 14, 292);
    doc.text(`Página ${i} de ${pages}`, W - 14, 292, { align: 'right' });
  }

  doc.save(`sushi-control-relatorio-${mes}.pdf`);
}
