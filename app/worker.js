import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

// This defines the ground truth for your specific model
const LABEL_MAP = {
  "0": "Leaf Miner",
  "1": "Powdery Mildew",
  "2": "Healthy",
  "3": "Early Blight",
  "4": "Late Blight"
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

      // DEBUG: View the model output structure in your F12 console
      console.log("Raw Model Output:", results);

      const sanitizedResults = results.map((r) => {
        // We use r.label (the model's class ID) instead of the loop index
        // If r.label is missing, we fallback to the index found in the result if possible
        const classId = r.label || "unknown";
        
        return {
          id: classId,
          label: LABEL_MAP[classId] || `Unknown ID: ${classId}`,
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