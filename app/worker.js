import { env, pipeline } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, imageDataUrl } = event.data;

  if (action === "analyze") {
    try {
      if (!classifier) {
        self.postMessage({ status: "loading", message: "Loading offline vision pipeline..." });
        
        // Pipeline automatically loads the processor, model, and config together
        classifier = await pipeline("image-classification", "plant_analyzer_model", {
          quantized: false 
        });
      }

      self.postMessage({ status: "processing", message: "Analyzing specimen..." });

      // The pipeline natively handles Data URLs and returns a clean, pre-sorted array of results
      const results = await classifier(imageDataUrl, { topk: 3 });

      self.postMessage({ status: "success", results: results });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});