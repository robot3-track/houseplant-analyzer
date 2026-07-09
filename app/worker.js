import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

// 1. HARDCODED LABEL MAP
// Update these names to match your actual model training order.
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
        // We explicitly force the task to image-classification
        classifier = await pipeline("image-classification", "plant_analyzer_model", { 
          quantized: true,
          task: "image-classification"
        });
      }

      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      const results = await classifier(rawImage, { topk: 5 });

      // 2. FORCED MAPPING
      // If the model returns undefined, we inject our LABEL_MAP based on the array index
      const sanitizedResults = results.map((r, index) => ({
        caseId: index,
        // If r.label exists, use it; otherwise, use our map
        label: r.label || LABEL_MAP[index] || "Unknown",
        score: r.score ?? 0,
        raw: r
      }));

      self.postMessage({ 
        status: "success", 
        results: sanitizedResults 
      });

    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ 
        status: "error", 
        error: error.message 
      });
    }
  }
});