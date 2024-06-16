import { describe, test, expect } from 'vitest'
import { createInstruction } from './instruction'
import { z } from 'zod'
import { Template } from './template'

describe('createInstruction', () => {
  test('called with Template', () => {
    const inst = createInstruction({
      template: Template.build(`hello {{world}}`),
    })

    expect(inst.template.render({ world: 'there' })).toEqual('hello there')
  })

  test('merges modelConfig with defaults', () => {
    const inst = createInstruction({
      template: Template.build(''),
      modelConfig: { temperature: 0.7 },
    })

    expect(inst.modelConfig.provider).toEqual('openai')
    expect(inst.modelConfig.temperature).toEqual(0.7)
  })

  test('`returns` and renders zod schema', () => {
    const inst = createInstruction({
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
        'the following typescript schema:\n\n' +
        '{\n' +
        '    /** whether or not the user appears to be gifted with musical talent */\n' +
        '    hasMusicalTalent: boolean;\n' +
        '}',
    )
  })
})
