import { assertEquals } from "jsr:@std/assert@1.0.8";
import { buildImageFunctions } from "^/together/together-image.ts";
import { mergeContext } from "^/merge.ts";

const { test } = Deno;

// Minimal mock implementation of Together client
const together = {
  images: {
    create: async (): Promise<
      { data: { b64_json?: string; url?: string }[] }
    > => {
      return { data: [{ url: "https://example.com/image.jpg" }] };
    },
  },
};

const fns = buildImageFunctions<{ task: string }>(together);

const buildPrompt = fns.initImagePromptBuilder({
  body: { model: "gpt-4o" },
  options: {},
  task: "chat",
});

const respondWithImage: typeof fns.respondWithImage = () => async (params) => {
  const context = mergeContext(params);
  const result = await fns.respondWithImage()(params);
  return [`${context.task}: ${result}`];
};

const prompt = buildPrompt(`Make an image for {{name}}`, respondWithImage());

test("Together image with additional context", async () => {
  const result = await prompt({ name: "Sam" });
  assertEquals(result[0], "chat: https://example.com/image.jpg");
});
