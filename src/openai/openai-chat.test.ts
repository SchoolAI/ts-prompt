import { assertEquals } from "jsr:@std/assert@1.0.8";
import { buildChatFunctions } from "^/openai/openai-chat.ts";
import { mergeContext } from "^/merge.ts";

const { test } = Deno;

// Minimal mock implementation of OpenAI client
const openai = {
  chat: {
    completions: {
      create: async (): Promise<{ choices: any[] }> => {
        return { choices: [{ message: { content: "hello Sam" } }] };
      },
    },
  },
};

const fns = buildChatFunctions<{ task: string }>(openai);

const buildPrompt = fns.initChatPromptBuilder({
  body: { model: "gpt-4o" },
  task: "chat",
});

const respondWithText: typeof fns.respondWithText = () => async (params) => {
  const context = mergeContext(params);
  const result = await fns.respondWithText()(params);
  return `${context.task}: ${result}`;
};

const prompt = buildPrompt(`Say "hello {{name}}"`, respondWithText());

test("OpenAI chat with additional context", async () => {
  const result = await prompt({ name: "Sam" });
  assertEquals(result, "chat: hello Sam");
});
