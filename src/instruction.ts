import { ZodObjectDef, ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Template, combineTemplates } from './template'
import { unindent } from './unindent'

export type Instruction<I, P extends string, Z extends ZodType<any, any>> = {
  config: I
  template: Template<P>
  returns: Z | undefined
}

const makeJsonTemplateString = (schema: ZodType<any, any>) =>
  unindent(`
    You must return the result as a JSON object. The result must strictly adhere to
    the following JSON schema:\n
  `) + JSON.stringify(zodToJsonSchema(schema), null, 2)

export const createInstruction = <
  I,
  P extends string,
  Z extends ZodType<any, ZodObjectDef>,
>({
  config: config,
  template,
  returns,
}: {
  config: I
  template: Template<P>
  returns?: Z | undefined
}): Instruction<I, P, Z> => {
  return {
    config,
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
    returns,
  }
}
