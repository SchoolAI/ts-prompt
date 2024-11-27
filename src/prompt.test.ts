import { assertEquals } from "jsr:@std/assert@1.0.8";
import { initPromptBuilder } from "./prompt.ts";
const { test } = Deno;

type ModelConfig = {
  provider: "openai";
  model: "gpt-3.5-turbo" | "gpt-4o";
};

type Request = {
  value: string;
} & ModelConfig;

const defaultRequest: Request = {
  value: "",
  provider: "openai",
  model: "gpt-3.5-turbo",
};

const buildPrompt = initPromptBuilder<Request>(defaultRequest);

test("createPrompt without template args", async () => {
  const request = buildPrompt(`hello`, async () => null);
  const result = await request({});
  assertEquals(result, null);
});

test("with template args", async () => {
  const request = buildPrompt(
    `hello {{world}}`,
    async ({ renderedTemplate }) => renderedTemplate,
  );
  const result = await request({
    templateArgs: { world: "earth" },
    request: { value: "" },
  });
  assertEquals(result, "hello earth");
});

test("with default prompt config", async () => {
  const request = buildPrompt(`hello`, async ({ request }) => request, {
    model: "gpt-4o",
  });
  const result = await request({ request: { value: "" } });
  assertEquals(result, {
    value: "",
    provider: "openai",
    model: "gpt-4o",
  });
});

test("with partial config", async () => {
  const request = buildPrompt(
    `hello`,
    async ({ request }) => `${request.provider}/${request.model}`,
  );
  const result = await request({
    request: { model: "gpt-4o" },
  });
  assertEquals(result, "openai/gpt-4o");
});

test("with request", async () => {
  const request = buildPrompt(
    `hello`,
    async ({ request }) => `${request.model} with ${request.value}`,
  );
  const result = await request({ request: { value: "context" } });
  assertEquals(result, "gpt-3.5-turbo with context");
});

test("returns typed result", async () => {
  type Result = { martians: number; earthlings: number };
  const request = buildPrompt(`hello`, async () => ({
    martians: 1,
    earthlings: 2,
  }));
  const result: Result = await request({ request: { value: "" } });
  assertEquals(result, { martians: 1, earthlings: 2 });
});
