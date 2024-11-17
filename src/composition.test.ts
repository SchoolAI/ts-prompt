import { assertEquals } from "jsr:@std/assert@1.0.8";
import { z, ZodSchema } from "zod";
import { InferenceFn, initPromptBuilder } from "./prompt.ts";
import { makeJsonTemplateString, stringToJsonSchema } from "./json.ts";
const { test } = Deno;

type ModelConfig = {
  provider: "openai";
  model: "gpt-3.5-turbo" | "gpt-4o";
};

const mkPrompt = initPromptBuilder<ModelConfig, PromptRequest>({
  provider: "openai",
  model: "gpt-3.5-turbo",
});

type PromptRequest = { timeline: string[] };

const resultSchema = z.object({
  messages: z.number(),
  martians: z.number(),
  comment: z.string(),
});

const makeJsonRequest = <C, X>(
  schema: ZodSchema,
  infer: InferenceFn<C, X, string>,
): InferenceFn<C, X, z.infer<typeof schema>> =>
async ({ request, config, renderedTemplate }) => {
  const renderedWithJsonInstructions = renderedTemplate + "\n" +
    makeJsonTemplateString(schema);

  const result = await infer({
    renderedTemplate: renderedWithJsonInstructions,
    request,
    config,
  });

  return stringToJsonSchema.pipe(schema).parse(result);
};

test("createPrompt and makeJsonRequest", async () => {
  const chatCompletion: InferenceFn<ModelConfig, PromptRequest, string> =
    async ({
      renderedTemplate,
      request,
      config,
    }) => {
      const messages = request.timeline.length;
      const martians = config.model.length;
      const comment = renderedTemplate.split("\n")[0] +
        "! " +
        renderedTemplate.match(/(http.*)#/)![1];
      return `{"messages": ${messages}, "martians": ${martians}, "comment": "${comment}"}`;
    };

  const request = mkPrompt(
    `hello {{world}}`,
    makeJsonRequest(resultSchema, chatCompletion),
  );

  const result = await request({
    templateArgs: { world: "earth" },
    request: { timeline: ["first message", "second message"] },
  });

  assertEquals(result.messages, 2);
  assertEquals(result.martians, 13);
  assertEquals(
    result.comment,
    "hello earth! http://json-schema.org/draft-07/schema",
  );
});
