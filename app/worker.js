import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

const LABEL_MAP = {
  0: "Powdery Mildew",
  1: "Healthy",
  2: "Early Blight",
  3: "Late Blight",
  4: "Septoria Leaf Spot"
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

      // DEBUG: Log the raw results to the console so we can see what's inside
      console.log("WORKER: Raw pipeline results:", results);

      const sanitizedResults = results.map((r, index) => {
        // Logic: 
        // 1. If r.label exists, use it.
        // 2. If not, try to look up via LABEL_MAP[index]
        // 3. Fallback to "Node ID: [index]"
        const label = r.label || LABEL_MAP[index] || `Node ID: ${index}`;
        
        return {
          ...r,
          id: index,
          label: label,
          score: r.score ?? 0,
          fullObject: r
        };
      });

      self.postMessage({ status: "success", results: sanitizedResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});