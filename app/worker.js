import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      // Initialize
      if (!classifier) {
        classifier = await pipeline("image-classification", "plant_analyzer_model");
      }

      // Convert the raw data to a Uint8Array
      const pixelData = new Uint8Array(rgbaData);

      // FIX: Wrap the pixel data in a RawImage object
      // We pass the width, height, and '4' for the RGBA channels
      const image = new RawImage(pixelData, width, height, 4);

      // Inference
      // Now pass the RawImage object, which the library understands
      const results = await classifier(image, { 
        topk: 5,
      });

      self.postMessage({ status: "success", results: results });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});