// (c) 2024 Vladislav Mamon
// This code is licensed under MIT license
// See https://github.com/norskeld/unindent/tree/6dcaad1ae26c4e51b114cabac23e9127722c0db8

// sentinel value for no spaces found
const NG_ONE = -1

const Chars = {
  /** Space. */
  SP: '\u0020',
  /** Horizontal tab. */
  HT: '\u0009',
  /** Line feed (Unix/macOS). */
  LF: '\u000A',
  /** Carriage return + Line feed (Windows). */
  CRLF: '\u000D\u000A',
} as const

function nonNegative(count: number): boolean {
  return count > NG_ONE
}

function toSpacesCount(line: string) {
  const chars = [...line].entries()

  for (const [idx, char] of chars) {
    if (char !== Chars.SP && char !== Chars.HT) {
      return idx
    }
  }

  return NG_ONE
}

function un$untagged(s: string): string {
  // Document may start either on the same line as opening quote/backtick or on the next line.
  const shouldIgnoreFirstLine = s.startsWith(Chars.LF)

  // TODO: Handle the `\r\n` case as well.
  const lines = s.split(Chars.LF)

  // Get everything but the 1st line.
  const [, ...rest] = lines

  // Get number of spaces for each line and leave only non-negative values.
  const counts = rest.length ? rest.map(toSpacesCount).filter(nonNegative) : [0]

  // Largest number of spaces that can be removed from every non-whitespace-only line after the 1st.
  const spaces = Math.min(...counts)

  // Resulting string.
  let result = String()

  for (const [idx, line] of lines.entries()) {
    if (idx > 1 || (idx === 1 && !shouldIgnoreFirstLine)) {
      result += Chars.LF
    }

    // Do not unindent anything on same line as opening quote/backtick.
    if (idx === 0) {
      result += line
    }
    // Whitespace-only lines may have fewer than the number of spaces being removed.
    else if (line.length > spaces) {
      result += line.slice(spaces)
    }
  }

  return result
}

function un$tagged(
  strings: TemplateStringsArray,
  ...values: Array<unknown>
): string {
  return un$untagged(String.raw({ raw: strings }, ...values))
}

/**
 * Unindents multiline string.
 *
 * This function takes a multiline string and unindents it so the leftmost non-space character is in
 * the first column.
 */
export function unindent(s: string): string
export function unindent(
  s: TemplateStringsArray,
  ...values: Array<unknown>
): string
export function unindent(
  s: string | TemplateStringsArray,
  ...values: Array<unknown>
): string {
  if (typeof s === 'string') {
    return un$untagged(s)
  } else if (Array.isArray(s)) {
    return un$tagged(s, ...values)
  }

  throw new Error(
    `Only 'string' and 'template strings array' allowed, but got '${typeof s}'.`,
  )
}
