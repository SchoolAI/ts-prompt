import Together from "together-ai";

import { initPromptBuilder } from "ts-prompt";

const together = new Together({ apiKey: Deno.env.get("TOGETHER_API_KEY") });

type ImageRequest = Together.Images.ImageCreateParams;

export const makeImagePrompt = initPromptBuilder<ImageRequest, string>({
  prompt: "", // Initially blank to satisfy type
  model: "black-forest-labs/FLUX.1-schnell",
  width: 512,
  height: 512,
  n: 1,
  steps: 4,
});

export const respondWithImage = () =>
async (
  { renderedTemplate, request: _request, config }: {
    renderedTemplate: string;
    request: string;
    config: ImageRequest;
  },
) =>
  await $getImageInference(together, renderedTemplate, {
    ...config,
  });

export const $getImageInference = async (
  together: Together,
  renderedTemplate: string,
  config: ImageRequest,
): Promise<(string | undefined)> => {
  const response = await together.images.create({
    ...config,
    prompt: renderedTemplate,
  });

  return response.data.map((d) => (d as any).url)[0];
};
