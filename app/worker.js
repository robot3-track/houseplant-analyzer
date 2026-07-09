import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      if (!classifier) {
        classifier = await pipeline("image-classification", "plant_analyzer_model", { 
          quantized: true,
          task: "image-classification"
        });
      }

      // FIX: Ensure we have a proper Uint8Array from the buffer
      // If rgbaData is passed as an object, we take the buffer property
      const data = rgbaData.buffer ? new Uint8Array(rgbaData.buffer) : new Uint8Array(rgbaData);

      // Create the RawImage safely
      const img = new RawImage(data, width, height, 4).rgb();
      const resized = img.resize(224, 224);

      const results = await classifier(resized, { topk: 5 });

      self.postMessage({ status: "success", results: results });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});