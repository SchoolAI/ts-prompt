import { assertEquals } from "jsr:@std/assert@1.0.8";
import { z, type ZodSchema } from "zod";
import { type InferenceFn, initPromptBuilder } from "./prompt.ts";
import { makeJsonTemplateString, stringToJsonSchema } from "./json.ts";
const { test } = Deno;

type PromptRequest = {
  timeline: string[];
  provider: "openai";
  model: "gpt-3.5-turbo" | "gpt-4o";
};

const mkPrompt = initPromptBuilder<PromptRequest>({
  timeline: [],
  provider: "openai",
  model: "gpt-3.5-turbo",
});

const resultSchema = z.object({
  messages: z.number(),
  martians: z.number(),
  comment: z.string(),
});

const makeJsonRequest = <X>(
  schema: ZodSchema,
  infer: InferenceFn<X, string>,
): InferenceFn<X, z.infer<typeof schema>> =>
async ({ request, renderedTemplate }) => {
  const renderedWithJsonInstructions = renderedTemplate + "\n" +
    makeJsonTemplateString(schema);

  const result = await infer({
    renderedTemplate: renderedWithJsonInstructions,
    request,
  });

  return stringToJsonSchema.pipe(schema).parse(result);
};

test("createPrompt and makeJsonRequest", async () => {
  const chatCompletion: InferenceFn<PromptRequest, string> = async ({
    renderedTemplate,
    request,
  }) => {
    const messages = request.timeline.length;
    const martians = request.model.length;
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
