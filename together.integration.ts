import Together from "npm:together-ai@0.10.0";
import { assert, assertEquals } from "jsr:@std/assert@1.0.8";
import { z } from "zod";
import { initPromptBuilder } from "./src/prompt.ts";
import type { ChatRequest } from "./src/utils.ts";
import { buildInferenceFunctionsForTogether } from "./together.ts";

const { test } = Deno;

const together = new Together({ apiKey: Deno.env.get("TOGETHER_API_KEY") });

const { respondWithImage, respondWithText, respondWithJson } =
  buildInferenceFunctionsForTogether(together);

const buildPrompt = initPromptBuilder<
  ChatRequest<Together.CompletionCreateParamsNonStreaming>
>({
  prompt: "",
  messages: [],
  model: "Qwen/Qwen2.5-7B-Instruct-Turbo",
  // model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
});

test("TogetherAI: build prompt and respond with text", async () => {
  const requestContent = buildPrompt(
    `
      You are a professional AI assistant for teachers. Respond in the language {{language}}.
      Be helpful and kind, and extremely concise by answering with a single word or phrase,
      with no punctuation.
    `,
    respondWithText(),
  );

  const capital = await requestContent({
    language: "English",
  }, {
    messages: [{ role: "user", content: "What is the capital of France?" }],
  });

  assertEquals(capital, "Paris");
});

test("TogetherAI: build prompt and respond with typed JSON", async () => {
  const requestJson = buildPrompt(
    `
      You are an educational consultant. Extract the course or lesson name, subject, duration,
      key topics, and target audience. If information is not available, do not make up details--
      instead, report as null (or empty array if appropriate).

      Record your findings in the natural language {{language}}.
    `,
    respondWithJson(
      z.object({
        name: z
          .string()
          .nullable()
          .describe("The name of the course or lesson."),
        subject: z
          .string()
          .nullable()
          .describe("The subject of the course or lesson."),
        duration: z
          .string()
          .nullable()
          .describe("The duration of the course or lesson."),
        keyTopics: z
          .array(z.string())
          .describe("The key topics covered in the course or lesson."),
        targetAudience: z
          .string()
          .nullable()
          .describe("The target audience for the course or lesson."),
      }),
    ),
  );

  const details = await requestJson(
    { language: "English" },
    {
      messages: [
        {
          role: "user",
          content: `
            The kindergarten class will be learning about the life cycle of a butterfly.
            The topic will cover the different stages from egg, to caterpillar, to chrysalis,
            and finally to butterfly. The lesson will include hands-on activities such as
            observing live caterpillars and creating butterfly crafts. The target audience
            for this lesson is young children aged 4-6 years old.
          `,
        },
      ],
    },
  );

  assert(details);
});

type ImageRequest = Together.Images.ImageCreateParams;

export const buildImagePrompt = initPromptBuilder<ImageRequest>({
  prompt: "", // Initially blank to satisfy type
  model: "black-forest-labs/FLUX.1-schnell",
  width: 512,
  height: 512,
  n: 1,
  steps: 4,
});

test("TogetherAI: build image prompt and create an image", async () => {
  const imagePrompt = buildImagePrompt(
    `
    {{request}}.
    Create a beautiful, flat color image suitable for iconography.
    Make it in the style of '{{style}}'.
    `,
    respondWithImage("url"),
  );

  const images = await imagePrompt({
    style: "absurdism",
    request: "a red apple",
  });

  assertEquals(images.length, 1);
});

// export const respondWithImage = () =>
// async (
//   { renderedTemplate, request: _request, config }: {
//     renderedTemplate: string;
//     request: string;
//     config: ImageRequest;
//   },
// ) =>
//   await $getImageInference(together, renderedTemplate, {
//     ...config,
//   });

// export const $getImageInference = async (
//   together: Together,
//   renderedTemplate: string,
//   config: ImageRequest,
// ): Promise<(string | undefined)> => {
//   const response = await together.images.create({
//     ...config,
//     prompt: renderedTemplate,
//   });

//   return response.data.map((d) => d.url)[0];
// };
