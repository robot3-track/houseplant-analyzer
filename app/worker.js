import { env, pipeline, RawImage } from "@huggingface/transformers";

// Strictly allow local files for offline usage
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      if (!classifier) {
        self.postMessage({ status: "loading", message: "Loading offline vision engine..." });
        classifier = await pipeline("image-classification", "plant_analyzer_model", { quantized: false });
      }

      self.postMessage({ status: "processing", message: "Normalizing cellular data..." });

      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      const results = await classifier(rawImage, { topk: 5 });

      // Spreading 'r' retains all raw properties from the model
      // 'fullObject' is passed to the UI for inspection
      const sanitizedResults = results.map((r, index) => ({
        ...r, 
        id: index,
        label: r.label || `Unmapped Node ID: ${index}`,
        score: r.score ?? 0,
        fullObject: r 
      }));

      self.postMessage({ status: "success", results: sanitizedResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});