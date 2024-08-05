import { describe, test, expect } from 'vitest'
import { unindent } from './unindent'
import { createInstruction } from './instruction'
import { z } from 'zod'
import { Template } from './template'
import { ModelConfig } from './openai'

const getDefaultConfig = (): ModelConfig => ({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
})

describe('createInstruction', () => {
  test('called with Template', () => {
    const inst = createInstruction({
      config: getDefaultConfig(),
      template: Template.build(`hello {{world}}`),
    })

    expect(inst.template.render({ world: 'there' })).toEqual('hello there')
  })

  test('merges modelConfig with defaults', () => {
    const inst = createInstruction({
      config: { ...getDefaultConfig(), temperature: 0.7 },
      template: Template.build(''),
    })

    expect(inst.config.provider).toEqual('openai')
    expect(inst.config.temperature).toEqual(0.7)
  })

  test('`returns` and renders zod schema', () => {
    const inst = createInstruction({
      config: getDefaultConfig(),
      template: Template.build(
        'Based on the conversation so far, determine if the user has musical talent.',
      ),
      returns: z.object({
        hasMusicalTalent: z
          .boolean()
          .describe(
            'whether or not the user appears to be gifted with musical talent',
          ),
      }),
    })

    expect(inst.returns?._def.typeName).toEqual('ZodObject')
    expect(inst.template.render()).toEqual(
      'Based on the conversation so far, determine if the user has musical talent.\n' +
        'You must return the result as a JSON object. The result must strictly adhere to\n' +
        'the following JSON schema:\n\n' +
        unindent(`{
          "type": "object",
          "properties": {
            "hasMusicalTalent": {
              "type": "boolean",
              "description": "whether or not the user appears to be gifted with musical talent"
            }
          },
          "required": [
            "hasMusicalTalent"
          ],
          "additionalProperties": false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }`),
    )
  })
})
