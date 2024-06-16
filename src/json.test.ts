import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import { stringToJsonSchema } from './json'

describe('stringToJsonSchema', () => {
  test('Converts string to json', () => {
    const json = stringToJsonSchema.parse('{"teacher":"Maria Montessori"}')
    expect(json).toEqual({ teacher: 'Maria Montessori' })
  })

  test('Can catch on error', () => {
    const secondSchema = z.object({ name: z.string() })
    const result = stringToJsonSchema
      .pipe(secondSchema.or(z.undefined()))
      .catch(undefined)
      .parse('')
    expect(result).toBe(undefined)
  })
})
