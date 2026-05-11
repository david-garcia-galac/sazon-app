'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  REPORT_RANGE_LABELS,
  REPORT_TYPE_LABELS,
  type EgresoRow,
  type IngresoRow,
  type ReportData,
} from './types'

const BRAND = { r: 234, g: 88, b: 12 } // orange-600

function fmtBs(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtFecha(s: string): string {
  return s.length >= 10 ? s.slice(0, 10) : s
}

function header(doc: jsPDF, data: ReportData) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, w, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('El Sazón de Amparo', 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(
    `${REPORT_TYPE_LABELS[data.config.type]} · ${REPORT_RANGE_LABELS[data.config.range]}`,
    14,
    19
  )
  doc.setFontSize(9)
  const rango =
    data.config.desde === data.config.hasta
      ? data.config.desde
      : `${data.config.desde} → ${data.config.hasta}`
  doc.text(rango, 14, 25)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.text(
    `Generado: ${new Date(data.generadoEn).toLocaleString('es-VE')}`,
    w - 14,
    25,
    { align: 'right' }
  )
  doc.setTextColor(0, 0, 0)
}

function footer(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Página ${i} de ${totalPages}`, w - 14, h - 6, { align: 'right' })
    doc.text('Reporte automático · sazon-app', 14, h - 6)
  }
}

function totalesBlock(doc: jsPDF, data: ReportData, startY: number): number {
  const t = data.totales
  autoTable(doc, {
    startY,
    head: [['Resumen del período', 'Valor']],
    body: [
      ['Ingresos (Bs)', `Bs ${fmtBs(t.ingresosBs)}`],
      ['Ingresos (USD)', `$ ${fmtUsd(t.ingresosUsd)}`],
      ['Egresos (Bs)', `Bs ${fmtBs(t.egresosBs)}`],
      ['Egresos (USD)', `$ ${fmtUsd(t.egresosUsd)}`],
      ['Saldo neto (Bs)', `Bs ${fmtBs(t.saldoBs)}`],
      ['Ventas registradas', String(t.ventas)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })
  // @ts-expect-error autoTable agrega lastAutoTable al doc en runtime
  return (doc.lastAutoTable?.finalY as number) ?? startY + 60
}

function ingresosTable(doc: jsPDF, rows: IngresoRow[], startY: number): number {
  if (!rows.length) return startY
  autoTable(doc, {
    startY: startY + 6,
    head: [['Fecha', 'Tipo', 'Bebida', 'Cant.', 'Monto', 'Moneda', 'Forma pago']],
    body: rows.map((r) => [
      fmtFecha(r.fecha),
      r.tipo,
      r.bebida ?? '—',
      r.cantidad,
      r.moneda === 'USD'
        ? `$ ${fmtUsd(Number(r.monto_usd ?? 0))}`
        : `Bs ${fmtBs(Number(r.monto))}`,
      r.moneda,
      r.forma_pago,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.4 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  })
  // @ts-expect-error idem
  return (doc.lastAutoTable?.finalY as number) ?? startY + 60
}

function egresosTable(doc: jsPDF, rows: EgresoRow[], startY: number): number {
  if (!rows.length) return startY
  autoTable(doc, {
    startY: startY + 6,
    head: [['Fecha', 'Categoría', 'Proveedor', 'Descripción', 'Monto', 'Moneda', 'Forma pago']],
    body: rows.map((r) => [
      fmtFecha(r.fecha),
      r.categoria,
      r.proveedor ?? '—',
      r.descripcion ?? '—',
      r.moneda === 'USD'
        ? `$ ${fmtUsd(Number(r.monto))}`
        : `Bs ${fmtBs(Number(r.monto))}`,
      r.moneda,
      r.forma_pago,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.4 },
    columnStyles: { 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  })
  // @ts-expect-error idem
  return (doc.lastAutoTable?.finalY as number) ?? startY + 60
}

/** Construye el PDF en memoria; devuelve Blob y nombre sugerido de archivo. */
export function buildReportPdf(data: ReportData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  header(doc, data)

  let y = 34
  y = totalesBlock(doc, data, y)

  if (data.config.type === 'ingresos' || data.config.type === 'resumen') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`Ingresos (${data.ingresos.length})`, 14, y + 8)
    y = ingresosTable(doc, data.ingresos, y + 4)
  }

  if (data.config.type === 'egresos' || data.config.type === 'resumen') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`Egresos (${data.egresos.length})`, 14, y + 10)
    y = egresosTable(doc, data.egresos, y + 6)
  }

  footer(doc)

  const blob = doc.output('blob')
  const filename = buildFilename(data)
  return { blob, filename }
}

export function buildFilename(data: ReportData): string {
  const tipo = data.config.type
  const rango = data.config.range
  const stamp =
    data.config.desde === data.config.hasta
      ? data.config.desde
      : `${data.config.desde}_${data.config.hasta}`
  return `sazon-${tipo}-${rango}-${stamp}.pdf`
}

/** Dispara la descarga local del blob (no navega). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
