import { expect, test } from 'claude-code/testing'

const MSG = { plugin: 'hebrew-rtl', component: 'AssistantMessage' } as const

const SAMPLE = [
  '# כותרת עם `code` ו-**English**',
  '',
  'פסקה עם [קישור](https://example.com), *נטוי*, ~~מחוק~~ ו-"Donald Knuth".',
  '',
  '- סעיף ראשון',
  '  - [x] סעיף מקונן',
  '',
  '> ציטוט בעברית',
  '',
  '| עמודה | Column |',
  '|---|---|',
  '| א | b |',
  '',
  '```py',
  'print("שלום")',
  '```',
  '',
  '---',
  '',
  'סוף.',
].join('\n')

test('a mixed Hebrew reply draws on the desktop without failing', async $ => {
  const ui = await $.ui.mount({ ...MSG, surface: 'desktop', props: { text: SAMPLE, isFirstOfReply: true } })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  expect(await ui.find({ type: 'Link' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /סעיף/ })).toBeDefined()
  await ui.unmount()
})

test('an English reply is left to the app', async $ => {
  const ui = await $.ui.mount({ ...MSG, surface: 'desktop', props: { text: 'Hello **world**', isFirstOfReply: true } })
  expect(await ui.find({ type: 'Text', text: /‫/ })).toBeUndefined()
  await ui.unmount()
})

test('the terminal is left alone', async $ => {
  const ui = await $.ui.mount({ ...MSG, surface: 'terminal', props: { text: 'שלום עולם', isFirstOfReply: true } })
  expect(await ui.find({ type: 'Text', text: /‫/ })).toBeUndefined()
  await ui.unmount()
})
