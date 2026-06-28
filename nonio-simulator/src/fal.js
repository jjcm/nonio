import { config } from "./config.js";
import { httpJson } from "./http.js";

export async function generateImage({ prompt, imageSize = "landscape_4_3" }) {
  // API docs: https://fal.ai/models/fal-ai/z-image/turbo/llms.txt
  const data = await httpJson("https://fal.run/fal-ai/z-image/turbo", {
    method: "POST",
    headers: {
      Authorization: `Key ${config.falKey}`
    },
    body: {
      prompt,
      image_size: imageSize,
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      acceleration: "none"
    }
  });

  const img = data?.images?.[0];
  if (!img?.url) throw new Error(`fal: missing image url: ${JSON.stringify(data)}`);
  return img;
}

export async function downloadBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} -> ${res.status}`);
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), contentType: res.headers.get("content-type") || "image/png" };
}


