import { expect, test } from 'claude-code/testing'

import { describe, embedding, group, isRtl, joined, parse, tokens } from '../hooks/rtl'
import type { Block } from '../hooks/rtl'

const d = (s: string) => describe(group(tokens(s)))
const kinds = (bs: Block[]) => bs.map(b => b.kind).join(',')
const firstLine = (s: string) => {
  const b = parse(s)[0]
  if (!b || b.kind !== 'rtl') throw new Error('not rtl: ' + s)
  return b.lines[0]!
}

// ------------------------------------------------------------ which paragraphs turn right-to-left

test('a Hebrew paragraph is right to left, an English one is not', async () => {
  expect(isRtl('שלום עולם')).toBe(true)
  expect(isRtl('Hello world')).toBe(false)
  expect(isRtl('The quick brown fox jumps over the lazy dog, שלום')).toBe(false)
  expect(isRtl('הנה: The quick brown fox jumps over the lazy dog')).toBe(true)
})

test('code spans and link targets do not make a paragraph English', async () => {
  expect(isRtl('`someVeryLongFunctionName()` מחזירה ערך')).toBe(true)
  expect(isRtl('[קישור](https://example.com/a/very/long/english/path)')).toBe(true)
})

test('Arabic is right to left too', async () => {
  expect(isRtl('مرحبا بالعالم')).toBe(true)
})

test('in a Hebrew reply, a mostly-English paragraph with Hebrew in it is right to left', async () => {
  const reply = 'כותרת בעברית\n\n"Premature optimization is the root of all evil" (Donald Knuth). כלומר: קודם.\n\nEnglish only here.'
  expect(kinds(parse(reply))).toBe('rtl,rtl,md')
})

test('in a Hebrew reply, a line of math alone is right to left; in an English reply it is not', async () => {
  expect(kinds(parse('כמה פעמים 256 נכנס ב-11,025:\n\n11,025 ÷ 256 = **43.07**'))).toBe('rtl,rtl')
  expect(kinds(parse('How many times:\n\n11,025 ÷ 256 = 43.07'))).toBe('md')
})

test('in an English reply, one Hebrew word does not flip the paragraph', async () => {
  const reply = 'This is a long English reply about the word שלום and what it means in context.'
  expect(kinds(parse(reply))).toBe('md')
})

test('code fences, tables and English stay markdown', async () => {
  expect(kinds(parse('שלום\n\n```js\nconst a = 1 // הערה\n```\n\nעוד'))).toBe('rtl,md,rtl')
  expect(kinds(parse('| שם | גיל |\n|---|---|\n| דנה | 5 |'))).toBe('md')
  expect(kinds(parse('הנה הטבלה:\n| a | b |\n|---|---|\n| 1 | 2 |'))).toBe('rtl,md')
  expect(kinds(parse('English only.\n\nAlso English.'))).toBe('md')
})

test('a fence with a blank line or Hebrew inside stays one markdown block', async () => {
  const bs = parse('```py\nx = 1\n\n# שלום\n```')
  expect(kinds(bs)).toBe('md')
})

test('an unclosed fence (a reply still streaming) stays markdown', async () => {
  expect(kinds(parse('שלום\n\n```py\nx = 1'))).toBe('rtl,md')
})

test('a fence of tildes or longer backticks closes only on its own kind', async () => {
  expect(kinds(parse('~~~\n```\nשלום\n~~~\nעוד'))).toBe('md,rtl')
  expect(kinds(parse('````\n```\nשלום\n````'))).toBe('md')
})

// ------------------------------------------------------------ lines

test('headings get a size, closing hashes are dropped', async () => {
  const h1 = firstLine('# כותרת ראשית')
  const h2 = firstLine('## כותרת ##')
  if (h1.type !== 'text' || h2.type !== 'text') throw new Error()
  expect(h1.size).toBe('title')
  expect(h2.size).toBe('heading')
  expect(describe(h2.items)).toBe('[rtl:כותרת]')
})

test('a setext underline makes the line above a heading', async () => {
  const b = parse('כותרת\n-----')[0]
  if (!b || b.kind !== 'rtl') throw new Error()
  expect(b.lines.length).toBe(1)
  expect(b.lines[0]!.type === 'text' && b.lines[0]!.size).toBe('heading')
})

test('a rule on its own line', async () => {
  const b = parse('שלום\n\n***\n\nעוד')
  expect(kinds(b)).toBe('rtl,md,rtl')
})

test('quotes and nesting', async () => {
  const q = firstLine('> > ציטוט')
  expect(q.type === 'text' && q.quote).toBe(2)
})

test('bullets, tasks and indentation', async () => {
  const b = parse('- אחד\n  - שתיים\n- [x] בוצע\n* [ ] לא בוצע')[0]
  if (!b || b.kind !== 'rtl') throw new Error()
  const ls = b.lines.map(l => (l.type === 'text' ? `${l.indent}:${describe(l.items)}` : 'rule'))
  expect(ls).toEqual([
    '0:[neu:•] [rtl:אחד]',
    '1:[neu:•] [rtl:שתיים]',
    '0:[neu:•] [neu:☑] [rtl:בוצע]',
    '0:[neu:•] [neu:☐] [rtl:לא] [rtl:בוצע]',
  ])
})

// ------------------------------------------------------------ words and runs

test('English words stay together in their own order', async () => {
  expect(d('השתמשו ב GitHub Actions כדי')).toBe('[rtl:השתמשו] [rtl:ב] [lat:GitHub Actions] [rtl:כדי]')
})

test('a Hebrew prefix with a hyphen splits off English', async () => {
  expect(d('ב-React ו-TypeScript')).toBe('[rtl:ב-] [lat+:React] [rtl:ו-] [lat+:TypeScript]')
  expect(d('כש-(Donald Knuth) אמר')).toBe('[rtl:כש-] [lat+:(Donald Knuth)] [rtl:אמר]')
})

test('a period after English goes back to the sentence', async () => {
  expect(d('אמר (Donald Knuth). כלומר')).toBe('[rtl:אמר] [lat:(Donald Knuth)] [neu+:.] [rtl:כלומר]')
})

test('a quotation in English keeps its quotes', async () => {
  expect(d('"Premature optimization is evil" (Knuth). כלומר')).toBe(
    '[lat:"Premature optimization is evil" (Knuth)] [neu+:.] [rtl:כלומר]',
  )
})

test('clause punctuation splits two English runs', async () => {
  expect(d('שלב ה-Deployment: CI/CD דרך')).toBe('[rtl:שלב] [rtl:ה-] [lat+:Deployment] [neu+::] [lat:CI/CD] [rtl:דרך]')
  expect(d('React, Vue ו-Svelte')).toBe('[lat:React] [neu+:,] [lat:Vue] [rtl:ו-] [lat+:Svelte]')
})

test('symbols and numbers inside an English run stay in it', async () => {
  expect(d('בחירת Node.js + PostgreSQL או')).toBe('[rtl:בחירת] [lat:Node.js + PostgreSQL] [rtl:או]')
  expect(d('הנוסחה E = mc² ידועה')).toBe('[rtl:הנוסחה] [lat:E = mc²] [rtl:ידועה]')
  expect(d('עם PEP 701 ו-f-strings')).toBe('[rtl:עם] [lat:PEP 701] [rtl:ו-] [lat+:f-strings]')
  expect(d('סיבוכיות O(n log n) בממוצע')).toBe('[rtl:סיבוכיות] [lat:O(n log n)] [rtl:בממוצע]')
})

test('numbers, dates, times, money and units', async () => {
  expect(d('ב-22/11/2026 בשעה 14:30.')).toBe('[rtl:ב-] [num+:22/11/2026] [rtl:בשעה] [num:14:30] [neu+:.]')
  expect(d('המחיר ₪1,250.00 כולל 17.5% מע"מ')).toBe('[rtl:המחיר] [num:₪1,250.00] [rtl:כולל] [num:17.5%] [rtl:מע"מ]')
  expect(d('טווח: -40°C עד +85°C.')).toBe('[rtl:טווח:] [lat:-40°C] [rtl:עד] [lat:+85°C] [neu+:.]')
  expect(d('(כיסוי של 80%+)')).toBe('[rtl:(כיסוי] [rtl:של] [num:80%+] [neu+:)]')
})

test('× and ÷ are math signs, and an expression reads left to right as one', async () => {
  expect(d('1,200 × 21 = 25,200 צעדים')).toBe('[num:1,200 × 21 = 25,200] [rtl:צעדים]')
  expect(d('₪1,200 ÷ 4 = ₪300')).toBe('[num:₪1,200 ÷ 4 = ₪300]')
  expect(d('סה"כ: 3 × 4 = 12 ש"ח')).toBe('[rtl:סה"כ:] [num:3 × 4 = 12] [rtl:ש"ח]')
  expect(d('אז 11,025 ÷ 256 = **43.07**')).toBe('[rtl:אז] [num:11,025 ÷ 256 = 43.07]')
  expect(d('50% מ-200 = 100')).toBe('[num:50%] [rtl:מ-] [num+:200 = 100]')
})

test('brackets in an expression stay in it, written with or without spaces', async () => {
  expect(d('(1+2)×3 = 9 וזה נכון')).toBe('[num:(1+2)×3 = 9] [rtl:וזה] [rtl:נכון]')
  expect(d('2 × (3 + 4) = 14 בדיוק')).toBe('[num:2 × (3 + 4) = 14] [rtl:בדיוק]')
})

test('a range, a lone sign and a list of numbers are not expressions', async () => {
  expect(d('הטווח 10–20 מעלות')).toBe('[rtl:הטווח] [num:10] [neu+:–] [num+:20] [rtl:מעלות]')
  expect(d('≈ 25,000 צעדים')).toBe('[neu:≈] [num:25,000] [rtl:צעדים]')
  expect(d('3 קבצים, 2 תיקיות')).toBe('[num:3] [rtl:קבצים,] [num:2] [rtl:תיקיות]')
  expect(d('יחס 3:1 ו-1/2 כוס')).toBe('[rtl:יחס] [num:3:1] [rtl:ו-] [num+:1/2] [rtl:כוס]')
})

test('a sign that belongs to a number stays on it', async () => {
  expect(d('המספר -5 שלילי')).toBe('[rtl:המספר] [num:-5] [rtl:שלילי]')
  expect(d('עלייה של 15% ו-$25.99')).toBe('[rtl:עלייה] [rtl:של] [num:15%] [rtl:ו-] [num+:$25.99]')
})

test('signs and numbers after an English run stay with it', async () => {
  expect(d('הפונקציה f(x) = 2x + 1 פשוטה')).toBe('[rtl:הפונקציה] [lat:f(x) = 2x + 1] [rtl:פשוטה]')
})

test('a bracket opened before English and closed after Hebrew stays in the sentence', async () => {
  expect(d('האפליקציה (iOS ו-Android) זמינה')).toBe(
    '[rtl:האפליקציה] [neu:(] [lat+:iOS] [rtl:ו-] [lat+:Android] [neu+:)] [rtl:זמינה]',
  )
  expect(d('הוספתי (React) לפרויקט')).toBe('[rtl:הוספתי] [lat:(React)] [rtl:לפרויקט]')
  expect(d('המודל (Opus 5.5) מהיר')).toBe('[rtl:המודל] [lat:(Opus 5.5)] [rtl:מהיר]')
})

test('brackets around Hebrew and numbers', async () => {
  expect(d('(בערך 1,200)')).toBe('[rtl:(בערך] [num:1,200] [neu+:)]')
  expect(d('התוצאה: 5 (במקום 4).')).toBe('[rtl:התוצאה:] [num:5] [rtl:(במקום] [num:4] [neu+:)] [neu+:.]')
})

test('English, code, numbers and plain Hebrew words carry no invisible marks, so they copy clean', async () => {
  const marks = (s: string) =>
    group(tokens(s)).map(it => `${joined(it)}:${embedding(it) ? 'mark' : 'clean'}`)
  expect(marks('שמרו בקובץ `fingerprint.py` עם 1,200 × 21 = 25,200 ו-GitHub')).toEqual([
    'שמרו:clean',
    'בקובץ:clean',
    'fingerprint.py:clean',
    'עם:clean',
    '1,200 × 21 = 25,200:clean',
    'ו-:mark',
    'GitHub:clean',
  ])
  expect(marks('רבים, (כיסוי) כן.')).toEqual(['רבים,:mark', '(כיסוי):mark', 'כן.:mark'])
  expect(marks('אמר (Knuth) ?!')).toEqual(['אמר:clean', '(Knuth):clean', '?!:mark'])
})

test('a question mark or colon flush against English stays glued', async () => {
  expect(d('בחרו `FastAPI`?')).toBe('[rtl:בחרו] [lat:FastAPI] [neu+:?]')
})

// ------------------------------------------------------------ inline markdown

test('bold, italic, strikethrough and code', async () => {
  const t = tokens('**מודגש** *נטוי* ~~מחוק~~ `code` ***שניהם***')
  expect(t.map(x => x.text)).toEqual(['מודגש', 'נטוי', 'מחוק', 'code', 'שניהם'])
  expect(t.map(x => Object.keys(x.style).sort().join('+'))).toEqual(['bold', 'italic', 'strike', 'mono', 'bold+italic'])
})

test('emphasis nests: code and links inside bold', async () => {
  const t = tokens('**שימו לב ל-`x` כאן**')
  expect(t.find(x => x.text === 'x')?.style).toEqual({ bold: true, mono: true })
})

test('underscores in snake_case are not italic', async () => {
  expect(tokens('המשתנה my_var_name חשוב').map(x => x.text)).toEqual(['המשתנה', 'my_var_name', 'חשוב'])
})

test('backslash escapes print the character itself', async () => {
  expect(tokens('כוכבית \\*לא נטוי\\*').map(x => x.text)).toEqual(['כוכבית', '*לא', 'נטוי*'])
})

test('double-backtick code keeps a backtick inside', async () => {
  expect(tokens('קוד ``a ` b`` כאן').map(x => x.text)).toEqual(['קוד', 'a ` b', 'כאן'])
})

test('links, images, autolinks and bare URLs', async () => {
  const t = tokens('[אתר](https://a.com) ![תמונה](https://a.com/x.png) <https://b.com> https://c.com/p.')
  expect(t.map(x => [x.text, x.href ?? ''])).toEqual([
    ['אתר', 'https://a.com'],
    ['תמונה', 'https://a.com/x.png'],
    ['https://b.com', 'https://b.com'],
    ['https://c.com/p', 'https://c.com/p'],
    ['.', ''],
  ])
})

test('a link with a title', async () => {
  expect(tokens('[כאן](https://a.com "כותרת")')[0]?.href).toBe('https://a.com')
})

test('Hebrew in quotes and abbreviations stays one word', async () => {
  expect(d('"שלום" אמר צה"ל')).toBe('[rtl:"שלום"] [rtl:אמר] [rtl:צה"ל]')
})

test('Windows paths keep their backslashes', async () => {
  expect(d(String.raw`הקובץ ב-C:\Users\me\file.txt.`)).toBe(String.raw`[rtl:הקובץ] [rtl:ב-] [lat+:C:\Users\me\file.txt] [neu+:.]`)
})

test('inline code at the end of a sentence keeps the period outside', async () => {
  expect(d('נסו את `npm install`.')).toBe('[rtl:נסו] [rtl:את] [lat:npm install] [neu+:.]')
})

test('an empty or symbol-only line does not throw', async () => {
  expect(d('')).toBe('')
  expect(d('🙂 ✓ →')).toBe('[neu:🙂] [neu:✓] [neu:→]')
})
