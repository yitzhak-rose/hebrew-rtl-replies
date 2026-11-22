// Pure text logic for hebrew-rtl-for-claude-code: no engine calls, so it can be tested on its own.
//
// A reply is cut into blocks. Code fences, tables and paragraphs that read left-to-right stay
// markdown, drawn by the app as usual. A right-to-left paragraph is cut into lines, and each line
// into items: a right-to-left word, a run of English (kept together, in its own order), a number,
// a symbol, or a link. The renderer lays the items out right to left.

/** Letters of right-to-left scripts: Hebrew, Arabic, Syriac, Thaana, NKo and their presentation forms. */
export const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/
const RTL_G = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g
const LAT = /[A-Za-z\u00C0-\u024F]/
const LAT_G = /[A-Za-z\u00C0-\u024F]/g
const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/
const ALNUM = /[A-Za-z\u00C0-\u024F0-9]/

/** Embedding marks. The desktop app keeps these (it drops the isolate marks U+2066..U+2069). */
export const RLE = '\u202B'
export const LRE = '\u202A'
export const PDF = '\u202C'

export type Style = { bold?: boolean; italic?: boolean; strike?: boolean; mono?: boolean }
export type Tok = { text: string; style: Style; href?: string; whole?: boolean; glue?: boolean }
export type Kind = 'rtl' | 'lat' | 'num' | 'neu' | 'link'
/** `glue`: written flush against the item before it, so no space between them. */
export type Item = { kind: Kind; toks: Tok[]; glue?: boolean }
export type Size = 'body' | 'heading' | 'title'
export type Line =
  | { type: 'text'; items: Item[]; size: Size; bold: boolean; quote: number; indent: number }
  | { type: 'rule' }
export type Block = { kind: 'md'; text: string } | { kind: 'rtl'; lines: Line[] }

const count = (s: string, c: string) => s.split(c).length - 1

// ---------------------------------------------------------------- blocks

/** The words people read: code spans, link targets and URLs left out. */
function proseOf(p: string): string {
  return p
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ')
}

/** The reply's prose without code fences and tables, to judge the reply as a whole. */
function replyProse(text: string): string {
  const keep: string[] = []
  let inFence = false
  for (const l of text.split('\n')) {
    if (FENCE.test(l)) inFence = !inFence
    else if (!inFence && !TABLE.test(l)) keep.push(l)
  }
  return keep.join('\n')
}

/** Whether a paragraph reads right to left: it opens with a right-to-left letter, or such letters
 * are at least half as many as Latin ones. Code spans and link targets are not counted. */
export function isRtl(p: string): boolean {
  const prose = proseOf(p)
  if (!RTL.test(prose)) return false
  const first = prose.match(/[A-Za-z\u00C0-\u024F\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/)?.[0] ?? ''
  if (RTL.test(first)) return true
  const r = (prose.match(RTL_G) || []).length
  const l = (prose.match(LAT_G) || []).length
  return r >= l * 0.5
}

const FENCE = /^\s*(`{3,}|~{3,})/
const TABLE = /^\s*\|/

/** Cut a reply into markdown blocks and right-to-left blocks. In a reply that reads right to left
 * as a whole, any paragraph with a right-to-left word in it is right to left (a Hebrew sentence
 * quoting a long English one); otherwise each paragraph is judged by itself. */
export function parse(text: string): Block[] {
  const out: Block[] = []
  const replyRtl = isRtl(replyProse(text))
  const rtlPara = (t: string) => (replyRtl ? RTL.test(proseOf(t)) : isRtl(t))
  const md = (t: string) => {
    const prev = out[out.length - 1]
    if (prev && prev.kind === 'md') prev.text += '\n\n' + t
    else out.push({ kind: 'md', text: t })
  }

  // Paragraph: blank-line separated prose. Tables inside it stay markdown on their own.
  const paragraph = (lines: string[]) => {
    let chunk: string[] = []
    let isTable = false
    const flush = () => {
      if (!chunk.length) return
      const t = chunk.join('\n')
      if (isTable || !rtlPara(t)) md(t)
      else out.push({ kind: 'rtl', lines: toLines(chunk) })
      chunk = []
    }
    for (const l of lines) {
      const t = TABLE.test(l)
      if (chunk.length && t !== isTable) flush()
      isTable = t
      chunk.push(l)
    }
    flush()
  }

  let para: string[] = []
  let fence: string[] | null = null
  let fenceMark = ''
  for (const l of text.split('\n')) {
    if (fence) {
      fence.push(l)
      const close = l.match(FENCE)
      if (close && close[1]![0] === fenceMark[0] && close[1]!.length >= fenceMark.length && l.trim() === close[1]) {
        md(fence.join('\n'))
        fence = null
      }
      continue
    }
    const open = l.match(FENCE)
    if (open) {
      paragraph(para)
      para = []
      fence = [l]
      fenceMark = open[1]!
      continue
    }
    if (l.trim() === '') {
      paragraph(para)
      para = []
    } else para.push(l)
  }
  if (fence) md(fence.join('\n'))
  paragraph(para)
  return out
}

// ---------------------------------------------------------------- lines

const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const SETEXT = /^\s*(=+|-+)\s*$/

/** The lines of a right-to-left paragraph: headings, quotes, list markers and indentation. */
export function toLines(raw: string[]): Line[] {
  const lines: Line[] = []
  for (const r of raw) {
    // A row of === or --- under a line makes that line a heading.
    const prev = lines[lines.length - 1]
    if (SETEXT.test(r) && prev && prev.type === 'text' && prev.quote === 0) {
      prev.size = r.trim().startsWith('=') ? 'title' : 'heading'
      prev.bold = true
      continue
    }
    if (RULE.test(r)) {
      lines.push({ type: 'rule' })
      continue
    }
    const indent = (r.match(/^\s*/)?.[0] ?? '').replace(/\t/g, '    ').length
    let l = r.trim()
    let quote = 0
    while (/^>\s?/.test(l)) {
      l = l.replace(/^>\s?/, '')
      quote++
    }
    let size: Size = 'body'
    let bold = false
    const h = l.match(/^(#{1,6})\s+(.*?)(\s+#+)?\s*$/)
    if (h) {
      const level = h[1]!.length
      l = h[2] ?? ''
      size = level === 1 ? 'title' : level <= 3 ? 'heading' : 'body'
      bold = true
    }
    const bullet = l.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      l = '\u2022 ' + (bullet[1] ?? '')
      l = l.replace(/^\u2022 \[[xX]\]\s*/, '\u2022 \u2611 ').replace(/^\u2022 \[ \]\s*/, '\u2022 \u2610 ')
    }
    lines.push({ type: 'text', items: group(tokens(l)), size, bold, quote, indent: Math.floor(indent / 2) })
  }
  return lines
}

// ---------------------------------------------------------------- words

// Backslash escapes are hidden from the inline patterns, then restored.
const ESCAPABLE = '\\`*_{}[]()#+-.!~|<>"\''
const hide = (s: string) =>
  s.replace(/\\([\\`*_{}\[\]()#+\-.!~|<>"'])/g, (_, c: string) => String.fromCharCode(0xe100 + ESCAPABLE.indexOf(c)))
const show = (s: string) =>
  s.replace(/[\ue100-\ue11f]/g, c => ESCAPABLE[c.charCodeAt(0) - 0xe100] ?? c)

const INLINE = new RegExp(
  [
    /!?\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)/.source, // link or image
    /<https?:\/\/[^>\s]+>/.source, // autolink
    /``(?:(?!``).)+``/.source, // code with a backtick inside
    /`[^`]+`/.source, // code
    /\*\*\*(?:(?!\*\*\*).)+\*\*\*/.source, // bold italic
    /\*\*(?:(?!\*\*).)+\*\*/.source, // bold
    /(?<![\w\u0590-\u08FF])__(?:(?!__).)+__(?![\w\u0590-\u08FF])/.source, // bold
    /~~(?:(?!~~).)+~~/.source, // strikethrough
    /\*[^*\s](?:[^*]*[^*\s])?\*/.source, // italic
    /(?<![\w\u0590-\u08FF])_[^_\s](?:[^_]*[^_\s])?_(?![\w\u0590-\u08FF])/.source, // italic
  ].join('|'),
  'g',
)

const URL = /^https?:\/\/\S+$/

/** A line's words, each with its style. Code spans and links stay whole. */
export function tokens(s: string, base: Style = {}): Tok[] {
  const out: Tok[] = []
  inline(hide(s), base, out, true)
  if (out[0]) out[0] = { ...out[0], glue: false }
  return out
}

// Returns whether the text ended in whitespace.
function inline(s: string, base: Style, out: Tok[], prevEndsWs: boolean): boolean {
  const parts = s.split(new RegExp(`(${INLINE.source})`, 'g'))
  for (const p of parts) {
    if (!p) continue
    const glue = !prevEndsWs && !/^\s/.test(p)
    const link = p.match(/^(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/)
    if (link) {
      const label = show(link[2] ?? '') || (link[1] ? 'image' : show(link[3] ?? ''))
      out.push({ text: label, href: show(link[3] ?? ''), style: base, whole: true, glue })
      prevEndsWs = false
      continue
    }
    const auto = p.match(/^<(https?:\/\/[^>\s]+)>$/)
    if (auto) {
      out.push({ text: auto[1]!, href: auto[1]!, style: base, whole: true, glue })
      prevEndsWs = false
      continue
    }
    const code = p.match(/^``\s?((?:(?!``).)+?)\s?``$/) ?? p.match(/^`([^`]+)`$/)
    if (code) {
      out.push({ text: show(code[1] ?? ''), style: { ...base, mono: true }, whole: true, glue })
      prevEndsWs = false
      continue
    }
    const emph =
      p.match(/^\*\*\*(.+)\*\*\*$/) ? { s: p.slice(3, -3), st: { bold: true, italic: true } }
      : p.match(/^(\*\*|__)(.+)\1$/) ? { s: p.slice(2, -2), st: { bold: true } }
      : p.match(/^~~(.+)~~$/) ? { s: p.slice(2, -2), st: { strike: true } }
      : p.match(/^([*_])(.+)\1$/) ? { s: p.slice(1, -1), st: { italic: true } }
      : null
    if (emph) {
      const before = out.length
      inline(emph.s, { ...base, ...emph.st }, out, prevEndsWs)
      if (out[before]) out[before] = { ...out[before]!, glue }
      prevEndsWs = false
      continue
    }
    let g = glue
    for (const w of p.split(/\s+/)) {
      if (!w) continue
      addWord(out, w, base, g)
      g = false
    }
    prevEndsWs = /\s$/.test(p)
  }
  return prevEndsWs
}

// One word: a right-to-left prefix joined to English by a hyphen ("ב-React") splits off, and so do
// brackets, quotes and punctuation on the edges of an English word or number, so that each part
// can take its own direction.
function addWord(out: Tok[], hidden: string, style: Style, glue: boolean) {
  const w = show(hidden)
  const pre = w.match(/^([\u0590-\u08FF]+[-\u05BE])(.*[A-Za-z0-9].*)$/)
  if (pre && !RTL.test(pre[2] ?? '')) {
    out.push({ text: pre[1]!, style, glue })
    addWord(out, pre[2]!, style, true)
    return
  }
  if (RTL.test(w) || !ALNUM.test(w)) {
    out.push({ text: w, style, glue })
    return
  }
  const m = w.match(/^([("'\[]*)(.*?)([.,;:!?)"'\]]*)$/)
  const lead = m?.[1] ?? ''
  let core = m?.[2] ?? ''
  let trail = m?.[3] ?? ''
  while (trail.startsWith(')') && count(core, '(') > count(core, ')')) {
    core += ')'
    trail = trail.slice(1)
  }
  while (trail.startsWith(']') && count(core, '[') > count(core, ']')) {
    core += ']'
    trail = trail.slice(1)
  }
  if (!core) {
    out.push({ text: w, style, glue })
    return
  }
  let g = glue
  if (lead) {
    out.push({ text: lead, style, glue: g })
    g = true
  }
  if (URL.test(core)) out.push({ text: core, href: core, style, whole: true, glue: g })
  else out.push({ text: core, style, glue: g })
  for (const piece of trail.match(/[)\]"']+|[.,;:!?]+/g) ?? []) out.push({ text: piece, style, glue: true })
}

export function kindOf(t: Tok): Kind {
  if (t.href !== undefined) return 'link'
  if (RTL.test(t.text)) return 'rtl'
  if (LAT.test(t.text)) return 'lat'
  if (DIGIT.test(t.text)) return 'num'
  return 'neu'
}

// Punctuation that ends a clause belongs to the sentence around it, never inside an English run.
const BREAK = /^[:;,.!?\u2013\u2014]+$/
const OPENER = /^[("'\[]+$/
const CLOSER = /^[)\]]+$/

/** Right-to-left words stand alone. English words form runs that keep the symbols, numbers and
 * brackets between and around them; clause punctuation and anything else rejoin the sentence. */
export function group(toks: Tok[]): Item[] {
  const items: Item[] = []
  let run: Tok[] | null = null
  let pending: Tok[] = []

  const closeRun = () => {
    if (run) {
      while (pending.length) {
        const t = pending[0]!
        const txt = run.map(x => x.text).join('')
        const balances =
          CLOSER.test(t.text) && (count(txt, '(') > count(txt, ')') || count(txt, '[') > count(txt, ']'))
        const closesQuote = (t.text === '"' || t.text === "'") && count(txt, t.text) % 2 === 1
        if (balances || closesQuote || kindOf(t) === 'num') {
          run.push(t)
          pending.shift()
        } else break
      }
      items.push({ kind: 'lat', toks: run, glue: run[0]!.glue })
      run = null
    }
    for (const t of pending) items.push({ kind: kindOf(t), toks: [t], glue: t.glue })
    pending = []
  }

  for (const t of toks) {
    const k = kindOf(t)
    if (k === 'lat') {
      if (run) {
        run.push(...pending, t)
        pending = []
      } else {
        closeRun()
        run = [t]
        // An opening bracket or quote written flush against this word opens the run.
        const prev = items[items.length - 1]
        if (t.glue && prev && prev.kind === 'neu' && prev.toks.length === 1 && OPENER.test(prev.toks[0]!.text)) {
          items.pop()
          run.unshift(prev.toks[0]!)
        }
      }
    } else if ((k === 'num' || k === 'neu') && run && !BREAK.test(t.text)) {
      pending.push(t)
    } else {
      closeRun()
      items.push({ kind: k, toks: [t], glue: t.glue })
    }
  }
  closeRun()
  return items
}

/** An item's text as one string, spaces restored between its words. */
export function joined(it: Item): string {
  return it.toks.map((t, i) => (i === 0 || t.glue ? '' : ' ') + t.text).join('')
}

/** A line written out item by item in reading order, for tests: `[kind:text]`, `+` when glued. */
export function describe(items: Item[]): string {
  return items.map(i => `[${i.kind}${i.glue ? '+' : ''}:${joined(i)}]`).join(' ')
}
