// Export PowerPoint du bilan : la même liste de diapositives (buildDeck) rendue
// en .pptx avec pptxgenjs. Le paquet est importé à la demande (dynamic import) :
// il ne pèse sur le chargement de l'app que si on clique sur « Télécharger ».
//
// Fonctionne dans le navigateur (téléchargement) — writeFile déclenche le download.

const BG = '12121A'
const CARD = '1E1E2A'
const TEXT = 'E8E8F0'
const MUTED = '8888A0'
const ROSE = 'FF6B8A'
const GOLD = 'F0C060'
const MINT = '4ADEC0'
const LAVENDER = 'A78BFA'

const SEV: Record<string, { color: string; label: string }> = {
  alert: { color: ROSE, label: 'À corriger' },
  warn: { color: GOLD, label: 'Vigilance' },
  info: { color: LAVENDER, label: 'À savoir' },
  ok: { color: MINT, label: 'Bon point' },
}

async function loadPptxGenJS(): Promise<any> {
  const mod: any = await import('pptxgenjs')
  // selon le bundle, la classe est en default ou à la racine
  return mod?.default || mod
}

function head(slide: any, pptx: any, title: string, subtitle?: string) {
  slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.5, w: 0.09, h: 0.55, fill: { color: ROSE } })
  slide.addText(title, { x: 0.85, y: 0.45, w: 11.9, h: 0.5, fontSize: 26, bold: true, color: TEXT, fontFace: 'Segoe UI' })
  if (subtitle) slide.addText(subtitle, { x: 0.85, y: 0.98, w: 11.9, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' })
}

function card(slide: any, pptx: any, x: number, y: number, w: number, h: number, color: string) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: CARD }, line: { color: '2A2A3E', width: 1 }, rectRadius: 0.08 })
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.06, h, fill: { color } })
}

/** Construit la présentation et renvoie l'instance PptxGenJS (non écrite). */
export async function buildPptx(deck: any): Promise<any> {
  const PptxGenJS = await loadPptxGenJS()
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Nous Deux'
  pptx.title = deck?.title || 'Bilan de gestion'

  for (const s of deck?.slides || []) {
    const slide = pptx.addSlide()
    slide.background = { color: BG }

    if (s.kind === 'title') {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.14, fill: { color: ROSE } })
      slide.addText(s.title || '', { x: 1, y: 2.3, w: 11.3, h: 1, fontSize: 44, bold: true, color: TEXT, fontFace: 'Segoe UI' })
      slide.addText(s.subtitle || '', { x: 1, y: 3.4, w: 11.3, h: 0.5, fontSize: 18, color: ROSE, fontFace: 'Segoe UI' })
      slide.addText(s.meta || '', { x: 1, y: 4, w: 11.3, h: 0.5, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' })
    }

    if (s.kind === 'kpis') {
      head(slide, pptx, s.title, s.subtitle)
      ;(s.items || []).forEach((it: any, i: number) => {
        const col = i % 2, row = Math.floor(i / 2)
        const x = 0.85 + col * 5.95, y = 1.7 + row * 2.6
        card(slide, pptx, x, y, 5.6, 2.3, it.color || ROSE)
        slide.addText(it.label, { x: x + 0.3, y: y + 0.25, w: 5, h: 0.35, fontSize: 12, color: MUTED, fontFace: 'Segoe UI' })
        slide.addText(String(it.value ?? ''), { x: x + 0.3, y: y + 0.65, w: 5, h: 0.8, fontSize: 30, bold: true, color: it.color || TEXT, fontFace: 'Segoe UI' })
        if (it.sub) slide.addText(it.sub, { x: x + 0.3, y: y + 1.5, w: 5, h: 0.6, fontSize: 11, color: MUTED, fontFace: 'Segoe UI' })
      })
    }

    if (s.kind === 'score') {
      head(slide, pptx, s.title, `Note globale ${s.total}/${s.max} — ${s.label}`)
      slide.addText(`${Math.round(s.total)}`, { x: 0.85, y: 1.6, w: 3, h: 1.3, fontSize: 60, bold: true, color: s.total / s.max >= 0.8 ? MINT : s.total / s.max >= 0.5 ? GOLD : ROSE, fontFace: 'Segoe UI' })
      slide.addText(`/ ${s.max}`, { x: 0.9, y: 2.85, w: 3, h: 0.4, fontSize: 16, color: MUTED, fontFace: 'Segoe UI' })
      slide.addChart('bar', [
        { name: 'Points', labels: (s.dimensions || []).map((d: any) => d.label), values: (s.dimensions || []).map((d: any) => d.points) },
      ], {
        x: 4.1, y: 1.6, w: 8.4, h: 2.6, barDir: 'bar', chartColors: [ROSE],
        showLegend: false, catAxisLabelColor: TEXT, valAxisLabelColor: MUTED,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, showValue: true, dataLabelColor: TEXT,
      })
      ;(s.dimensions || []).forEach((d: any, i: number) => {
        slide.addText(`${d.label} — ${d.detail}`, {
          x: 0.85, y: 4.4 + i * 0.55, w: 11.6, h: 0.45, fontSize: 11, color: MUTED, fontFace: 'Segoe UI',
          bullet: { code: '25AA' },
        })
      })
    }

    if (s.kind === 'chart' && s.chart === 'bar') {
      head(slide, pptx, s.title, s.subtitle)
      slide.addChart('bar', (s.series || []).map((se: any, i: number) => ({
        name: se.name, labels: s.categories, values: (s.values || [])[i] || [],
      })), {
        x: 0.85, y: 1.6, w: 11.6, h: 4.4, barGrouping: 'stacked', chartColors: (s.series || []).map((x: any) => x.color),
        showLegend: true, legendPos: 'b', legendColor: TEXT, catAxisLabelColor: TEXT, valAxisLabelColor: MUTED,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      })
      if (s.footer) slide.addText(s.footer, { x: 0.85, y: 6.2, w: 11.6, h: 0.5, fontSize: 10, color: MUTED, fontFace: 'Segoe UI' })
    }

    if (s.kind === 'chart' && s.chart === 'pie') {
      head(slide, pptx, s.title, s.subtitle)
      slide.addChart('doughnut', (s.series || []).map((se: any) => ({ name: se.name, labels: s.categories, values: (s.values || [])[0] || [] })), {
        x: 0.85, y: 1.6, w: 7, h: 4.6, chartColors: s.colors, showLegend: true, legendPos: 'r', legendColor: TEXT,
        showPercent: true, dataLabelColor: TEXT, dataLabelFontSize: 10,
      })
      slide.addText((s.categories || []).map((c: string, i: number) => `${c} : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format((s.values?.[0] || [])[i] || 0)}`).join('\n'), {
        x: 8.1, y: 1.9, w: 4.4, h: 4, fontSize: 11, color: MUTED, fontFace: 'Segoe UI', lineSpacingMultiple: 1.4,
      })
    }

    if (s.kind === 'chart' && s.chart === 'rule') {
      head(slide, pptx, s.title, s.subtitle)
      slide.addChart('bar', [
        { name: 'Réel', labels: (s.rows || []).map((x: any) => x.label), values: (s.rows || []).map((x: any) => x.real) },
        { name: 'Objectif', labels: (s.rows || []).map((x: any) => x.label), values: (s.rows || []).map((x: any) => x.target) },
      ], {
        x: 0.85, y: 1.6, w: 11.6, h: 4.4, chartColors: [ROSE, MINT], showLegend: true, legendPos: 'b', legendColor: TEXT,
        catAxisLabelColor: TEXT, valAxisLabelColor: MUTED, showValue: true, dataLabelColor: TEXT, dataLabelFontSize: 10,
      })
    }

    if (s.kind === 'chart' && s.chart === 'people') {
      head(slide, pptx, s.title, s.subtitle)
      const metrics = ['Dépensé', 'Mis de côté', 'Revenus']
      slide.addChart('bar', metrics.map((m, mi) => ({
        name: m,
        labels: (s.rows || []).map((x: any) => x.label),
        values: (s.rows || []).map((x: any) => x.values[mi]?.value || 0),
      })), {
        x: 0.85, y: 1.6, w: 11.6, h: 4.4, chartColors: [ROSE, GOLD, MINT], showLegend: true, legendPos: 'b', legendColor: TEXT,
        catAxisLabelColor: TEXT, valAxisLabelColor: MUTED, showValue: true, dataLabelColor: TEXT, dataLabelFontSize: 10,
      })
    }

    if (s.kind === 'advice') {
      const sev = SEV[s.severity] || SEV.info
      head(slide, pptx, 'Conseils', s.step)
      card(slide, pptx, 0.85, 1.7, 11.6, 4.6, sev.color)
      slide.addText(s.title || '', { x: 1.3, y: 2.2, w: 10.6, h: 1, fontSize: 24, bold: true, color: TEXT, fontFace: 'Segoe UI' })
      slide.addText(sev.label.toUpperCase(), { x: 1.3, y: 3.2, w: 10.6, h: 0.3, fontSize: 11, bold: true, color: sev.color, fontFace: 'Segoe UI', charSpacing: 1.5 })
      slide.addText(s.text || '', { x: 1.3, y: 3.7, w: 10.6, h: 2.2, fontSize: 14, color: TEXT, fontFace: 'Segoe UI', lineSpacingMultiple: 1.35 })
    }

    if (s.kind === 'table') {
      head(slide, pptx, s.title, s.subtitle)
      slide.addTable([
        (s.head || []).map((h: string) => ({ text: h, options: { bold: true, color: MUTED, fontSize: 11, fill: { color: BG } } })),
        ...(s.rows || []).map((row: string[]) => row.map((cell, ci) => ({
          text: cell,
          options: { color: ci === row.length - 1 ? TEXT : MUTED, fontSize: 11, bold: ci === row.length - 1, fill: { color: CARD } },
        }))),
      ], { x: 0.85, y: 1.7, w: 11.6, border: { type: 'solid', color: '2A2A3E', pt: 0.5 }, rowH: 0.42, valign: 'middle', autoPage: false })
    }

    if (s.kind === 'note') {
      head(slide, pptx, s.title)
      slide.addText(s.text || '', { x: 0.85, y: 1.8, w: 11.6, h: 3, fontSize: 14, color: MUTED, fontFace: 'Segoe UI', lineSpacingMultiple: 1.5 })
    }
  }

  return pptx
}

/** Génère et télécharge le .pptx dans le navigateur. */
export async function downloadPptx(deck: any, fileName?: string) {
  const pptx = await buildPptx(deck)
  const name = fileName || `bilan-gestion-${deck?.month || new Date().toISOString().slice(0, 7)}.pptx`
  await pptx.writeFile({ fileName: name })
  return name
}
