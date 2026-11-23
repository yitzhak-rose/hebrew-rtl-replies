import type { Register } from 'claude-code'

import { PDF, RTL, embedding, joined, parse } from './rtl'
import type { Item, Line, Style } from './rtl'

const NBSP = ' '

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    // The terminal orders right-to-left text by itself, and the other surfaces are untested.
    if (e.surface !== 'desktop') return next(e)
    const text: string = e.props.text
    if (!RTL.test(text)) return next(e)

    const blocks = parse(text)
    if (!blocks.some(b => b.kind === 'rtl')) return next(e)

    const { Box, Text, Markdown, Link } = $.ui.resolve(e)

    const styled = (st: Style) => !!(st.bold || st.italic || st.strike || st.mono)
    const same = (a: Style, b: Style) =>
      !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.strike === !!b.strike && !!a.mono === !!b.mono

    const leaf = (s: string, st: Style) =>
      styled(st) ? (
        <Text weight={st.bold ? 'semibold' : undefined} italic={st.italic} strikethrough={st.strike} mono={st.mono}>
          {s}
        </Text>
      ) : (
        s
      )

    // An item's text, inside an embedding only where its order needs one (the marks are copied
    // with the text, so English, code and numbers carry none).
    const body = (it: Item) => {
      const open = embedding(it)
      const close = open ? PDF : ''
      const first = it.toks[0]!
      if (it.toks.every(t => same(t.style, first.style))) return [leaf(open + joined(it) + close, first.style)]
      const parts = it.toks.flatMap((t, i) => {
        const l = leaf(t.text, t.style)
        return i === 0 || t.glue ? [l] : [' ', l]
      })
      return open ? [open, ...parts, close] : parts
    }

    const line = (ln: Line) => {
      if (ln.type === 'rule') {
        return (
          <Text dimColor wrap="clip" maxLines={1}>
            {'─'.repeat(300)}
          </Text>
        )
      }
      const { size, bold, quote, indent } = ln
      const dim = quote > 0
      const items: Item[] = quote > 0 ? [{ kind: 'neu', toks: [{ text: '┃'.repeat(quote), style: {} }] }, ...ln.items] : ln.items

      // Items run right to left and wrap from the right edge. The space between two items is a
      // no-break space at the left of the first, left out when the next is written flush against it.
      return (
        <Box
          flexDirection="row-reverse"
          flexWrap="wrap"
          justifyContent="flex-start"
          columnGap={0}
          rowGap="xs"
          paddingRight={indent === 0 ? 0 : indent === 1 ? 'lg' : 'xl'}
        >
          {items.map((it, n) => {
            const gap = n === items.length - 1 || items[n + 1]?.glue ? '' : NBSP
            if (it.kind === 'link') {
              const t = it.toks[0]!
              return (
                <Box flexDirection="row">
                  <Text size={size}>{gap}</Text>
                  <Link href={t.href ?? ''} label={t.text} />
                </Box>
              )
            }
            return (
              <Text size={size} weight={bold ? 'semibold' : undefined} dimColor={dim}>
                {gap}
                {body(it)}
              </Text>
            )
          })}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap="sm">
        {blocks.map(b =>
          b.kind === 'md' ? (
            <Markdown text={b.text} />
          ) : (
            <Box flexDirection="column" gap="xs">
              {b.lines.map(line)}
            </Box>
          )
        )}
      </Box>
    )
  })
}
