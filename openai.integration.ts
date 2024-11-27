import { assert, assertEquals } from "jsr:@std/assert@1.0.8";
import { z } from "zod";
import { OpenAI } from "openai";
import type { ImageGenerateParams } from "openai/resources/images.mjs";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { initPromptBuilder } from "./src/prompt.ts";
import {
  buildInferenceFunctionsForOpenAI,
  type ChatRequest,
} from "./openai.ts";

const { test } = Deno;

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

const { respondWithImage, respondWithText, respondWithJson } =
  buildInferenceFunctionsForOpenAI(openai);

const buildPrompt = initPromptBuilder<
  ChatRequest<ChatCompletionCreateParamsNonStreaming>
>({
  messages: [],
  model: "gpt-4o",
});

test("buildPrompt - request content", async () => {
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

test("buildPrompt - requestJson", async () => {
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

const buildImagePrompt = initPromptBuilder<ImageGenerateParams>({
  prompt: "",
  model: "dall-e-2",
  size: "256x256",
  response_format: "url",
});

test("buildImagePrompt - request", async () => {
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
