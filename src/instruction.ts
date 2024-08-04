import unindent from '@nrsk/unindent'
import { ZodObjectDef, ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Template, combineTemplates } from './template'
import { ModelConfigBase } from './types'

export type Instruction<
  P extends string,
  M extends ModelConfigBase,
  Z extends ZodType<any, any>,
> = {
  template: Template<P>
  config: M
  returns: Z | undefined
}

const makeJsonTemplateString = (schema: ZodType<any, any>) =>
  unindent(`
    You must return the result as a JSON object. The result must strictly adhere to
    the following JSON schema:\n
  `) + JSON.stringify(zodToJsonSchema(schema), null, 2)

export const createInstruction = <
  P extends string,
  M extends ModelConfigBase,
  Z extends ZodType<any, ZodObjectDef>,
>({
  getDefaultConfig,
  template,
  config,
  returns,
}: {
  getDefaultConfig: () => M
  template: Template<P>
  config?: Partial<M>
  returns?: Z | undefined
}): Instruction<P, M, Z> => {
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
    config: { ...getDefaultConfig(), ...config },
    returns,
  }
}
