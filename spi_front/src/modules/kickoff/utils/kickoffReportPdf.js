import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NAVY  = [10,  22,  40];
const CYAN  = [0,   168, 212];
const GOLD  = [196, 154, 16];
const GRAY  = [100, 116, 139];
const WHITE = [255, 255, 255];
const LIGHT = [241, 245, 249];
const GREEN = [22,  163, 74];
const RED   = [220, 38,  38];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusLabel(status) {
  const map = {
    under_review: 'En revisión',
    approved:     'Aprobada',
    highlighted:  'Destacada',
    answered:     'Respondida',
    hidden:       'Oculta',
    rejected:     'Rechazada',
  };
  return map[status] || status;
}

function wrapText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generateKickoffPDF({ eventName, stats, aportes, questions }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pw - margin * 2;

  // ── Header ──────────────────────────────────────────────────────────────────

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 38, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KICK OFF 2026', margin, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(106, 138, 170);
  doc.text('MISIÓN POSIBLE · AGENTES DE CAMBIO', margin, 23);

  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(eventName || 'Reporte del Evento', margin, 31);

  // Date top right
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(106, 138, 170);
  const today = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Generado: ${today}`, pw - margin, 31, { align: 'right' });

  let y = 48;

  // ── Stats cards ─────────────────────────────────────────────────────────────

  const cards = [
    { label: 'Aportes registrados',  value: stats.total_aportes,                      color: CYAN  },
    { label: 'Promedio general',     value: stats.avg_rating_overall ? `${stats.avg_rating_overall} ★` : '—', color: GOLD },
    { label: 'Preguntas recibidas',  value: stats.total_questions,                    color: NAVY  },
    { label: 'Preguntas respondidas',value: stats.answered_questions,                 color: GREEN },
  ];

  const cardW = (contentW - 6) / 4;
  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 2);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.color);
    doc.text(String(c.value ?? '—'), cx + cardW / 2, y + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(c.label, cx + cardW / 2, y + 15, { align: 'center' });
  });

  y += 26;

  // ── Section: Aportes ────────────────────────────────────────────────────────

  doc.setFillColor(...CYAN);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`💡  APORTES  (${aportes.length})`, margin + 3, y + 5);
  y += 10;

  if (aportes.length === 0) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No hay aportes registrados.', margin, y + 5);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles:       { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', font: 'helvetica' },
      headStyles:   { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 38 },
        2: { cellWidth: contentW - 32 - 38 - 20 },
        3: { cellWidth: 20, halign: 'center' },
      },
      head: [['Presentación', 'Colaborador', 'Aporte', 'Calif.']],
      body: aportes.map(a => [
        a.presentation_title,
        a.collaborator_name,
        a.aporte_text,
        a.avg_rating ? `${parseFloat(a.avg_rating).toFixed(1)} (${a.rating_count}v)` : 'Sin votos',
      ]),
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // New page if little space left
  if (y > ph - 60) { doc.addPage(); y = 20; }

  // ── Section: Questions ──────────────────────────────────────────────────────

  doc.setFillColor(...NAVY);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`❓  PREGUNTAS  (${questions.length})`, margin + 3, y + 5);
  y += 10;

  if (questions.length === 0) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No hay preguntas registradas.', margin, y + 5);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles:       { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', font: 'helvetica' },
      headStyles:   { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 25 },
        2: { cellWidth: contentW - 32 - 25 - 20 },
        3: { cellWidth: 20, halign: 'center' },
      },
      head: [['Presentación', 'Autor', 'Pregunta / Respuesta', 'Estado']],
      body: questions.map(q => {
        const cell = q.answer_text
          ? `P: ${q.question_text}\n\nR: ${q.answer_text}`
          : q.question_text;
        return [
          q.presentation_title,
          q.display_name,
          cell,
          statusLabel(q.status),
        ];
      }),
      didParseCell(data) {
        if (data.column.index === 3 && data.section === 'body') {
          const st = questions[data.row.index]?.status;
          if (st === 'answered')   data.cell.styles.textColor = GREEN;
          if (st === 'highlighted') data.cell.styles.textColor = CYAN;
          if (st === 'rejected')   data.cell.styles.textColor = RED;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Footer on each page ──────────────────────────────────────────────────────

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, ph - 8, pw, 8, 'F');
    doc.setFontSize(7);
    doc.setTextColor(106, 138, 170);
    doc.text('FAM PROJECT · Sistema de Planificación Interno', margin, ph - 3);
    doc.text(`Página ${i} / ${pageCount}`, pw - margin, ph - 3, { align: 'right' });
  }

  const filename = `kickoff-2026-resumen-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
