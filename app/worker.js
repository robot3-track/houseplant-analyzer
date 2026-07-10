import { env, pipeline } from "@huggingface/transformers";

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

      // Convert to proper format
      const pixelData = new Uint8Array(rgbaData);

      // Inference
      // Because your config.json has 'id2label', the result 
      // will already contain the label string (e.g., "Corn___Healthy")
      const results = await classifier(pixelData, { 
        topk: 5,
        // The library handles raw image conversion automatically if needed
      });

      self.postMessage({ status: "success", results: results });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});