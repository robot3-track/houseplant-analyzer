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
        // FIXED: Changed to quantized: true to match your exact folder structure
        // This tells it to look in /models/plant_analyzer_model/onnx/model_quantized.onnx
        classifier = await pipeline("image-classification", "plant_analyzer_model", { quantized: true });
      }

      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      const results = await classifier(rawImage, { topk: 5 });

      const sanitizedResults = results.map((r) => ({
        caseId: r.label, 
        score: r.score ?? 0
      }));

      self.postMessage({ status: "success", results: sanitizedResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});