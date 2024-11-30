import { assertEquals } from "jsr:@std/assert@1.0.8";
import { z, type ZodSchema } from "zod";
import { type InferenceFn, initPromptBuilder } from "./prompt.ts";
import { makeJsonTemplateString, stringToJsonSchema } from "./json.ts";
import { mergeContext } from "./merge.ts";

const { test } = Deno;

type PromptContext = {
  timeline: string[];
  provider: "openai";
  model: "gpt-3.5-turbo" | "gpt-4o";
};

const buildPrompt = initPromptBuilder<PromptContext>({
  timeline: [],
  provider: "openai",
  model: "gpt-3.5-turbo",
});

const resultSchema = z.object({
  messages: z.number(),
  martians: z.number(),
  comment: z.string(),
});

const makeJsonRequest = <Ctx, P extends string>(
  schema: ZodSchema,
  infer: InferenceFn<Ctx, P, string>,
): InferenceFn<Ctx, P, z.infer<typeof schema>> =>
async (params) => {
  const renderedWithJsonInstructions = params.renderedTemplate + "\n" +
    makeJsonTemplateString(schema);

  const result = await infer({
    ...params,
    renderedTemplate: renderedWithJsonInstructions,
  });

  return stringToJsonSchema.pipe(schema).parse(result);
};

test("createPrompt and makeJsonRequest", async () => {
  const chatCompletion: InferenceFn<PromptContext, string, string> = async (
    params,
  ) => {
    const context = mergeContext(params);
    const messages = context.timeline.length;
    const martians = context.model.length;
    const comment = params.renderedTemplate.split("\n")[0] +
      "! " +
      params.renderedTemplate.match(/(http.*)#/)![1];
    return `{"messages": ${messages}, "martians": ${martians}, "comment": "${comment}"}`;
  };

  const request = buildPrompt(
    `hello {{world}}`,
    makeJsonRequest(resultSchema, chatCompletion),
  );

  const result = await request({
    world: "earth",
  }, {
    timeline: ["first message", "second message"],
  });

  assertEquals(result.messages, 2);
  assertEquals(result.martians, 13);
  assertEquals(
    result.comment,
    "hello earth! http://json-schema.org/draft-07/schema",
  );
});
