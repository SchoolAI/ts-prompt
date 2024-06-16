import unindent from '@nrsk/unindent'
import { ZodObjectDef, ZodType } from 'zod'
import { zodToTs, printNode } from 'zod-to-ts'
import { Template, combineTemplates } from './template'
import { ModelConfig } from './types'

export type Instruction<P extends string, Z extends ZodType<any, any>> = {
  template: Template<P>
  modelConfig: ModelConfig
  returns: Z | undefined
}

const INSTRUCTION_DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  topP: 1,
  temperature: 0.2,
  responseFormat: 'json',
}

const makeJsonTemplateString = (schema: ZodType<any, any>) =>
  unindent(`
    You must return the result as a JSON object. The result must strictly adhere to
    the following typescript schema:\n
  `) + printNode(zodToTs(schema, 'JsonReturn').node)

export const createInstruction = <
  P extends string,
  Z extends ZodType<any, ZodObjectDef>,
>({
  template,
  modelConfig,
  returns,
}: {
  template: Template<P>
  modelConfig?: Partial<ModelConfig>
  returns?: Z | undefined
}): Instruction<P, Z> => {
  return {
    template: returns
      ? combineTemplates(
          template,
          // We must typecast to Template<''> here, because the return type of makeJsonTemplate-
          // String is a generic string type, and a generic string type merged with any other
          // template string literal type is just a string type again. Narrowing to an empty string
          // type ('') avoids this.
          Template.build(makeJsonTemplateString(returns)) as Template<''>,
        )
      : template,
    modelConfig: { ...INSTRUCTION_DEFAULT_MODEL_CONFIG, ...modelConfig },
    returns,
  }
}
