import { env, pipeline, RawImage } from "@huggingface/transformers";

// Configuration
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

// Mapping for your diagnostic display
const LABEL_MAP = {
  0: "Powdery Mildew",
  1: "Healthy",
  2: "Early Blight",
  3: "Late Blight",
  4: "Septoria Leaf Spot"
};

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

      // FIX: Explicitly cast the incoming Uint8ClampedArray to a standard Uint8Array
      // This solves the "Unsupported input type: object" error.
      const pixelData = new Uint8Array(rgbaData);

      // Create the RawImage from the corrected array
      const img = new RawImage(pixelData, width, height, 4).rgb();
      const resized = img.resize(224, 224);

      // Run inference
      const results = await classifier(resized, { topk: 5 });

      // Sanitization & Mapping
      const sanitizedResults = results.map((r, index) => ({
        id: index,
        label: r.label || LABEL_MAP[index] || `Unknown Class ${index}`,
        score: r.score ?? 0,
        raw: r
      }));

      self.postMessage({ status: "success", results: sanitizedResults });

    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});