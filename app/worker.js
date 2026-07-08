import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

// THIS IS YOUR SOURCE OF TRUTH
// If the app labels something wrong, change the name here.
const LABEL_MAP = {
  0: "Leaf Miner", // Update this based on the index you see for this image
  1: "Powdery Mildew",
  2: "Healthy",
  3: "Early Blight",
  4: "Late Blight"
};

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      if (!classifier) {
        classifier = await pipeline("image-classification", "plant_analyzer_model", { quantized: false });
      }

      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      const results = await classifier(rawImage, { topk: 5 });

      // Sanitized results with aggressive fallback
      const sanitizedResults = results.map((r, index) => {
        // 1. Try model label, 2. Try our map, 3. Fallback to index
        const label = r.label || LABEL_MAP[index] || `Node ID: ${index}`;
        
        return {
          ...r,
          id: index,
          label: label,
          score: r.score ?? 0
        };
      });

      self.postMessage({ status: "success", results: sanitizedResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});