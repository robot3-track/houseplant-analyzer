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
        classifier = await pipeline("image-classification", "plant_analyzer_model", { quantized: true });
      }

      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      const results = await classifier(rawImage, { topk: 5 });

      // FIX: We explicitly capture the index (0, 1, 2, 3, 4) as the Case ID
      // This ensures we always have an ID to reference, even if the model metadata is empty.
      const sanitizedResults = results.map((r, index) => ({
        caseId: index, 
        label: r.label,
        score: r.score ?? 0,
        raw: r // Keep this for your F12 console inspection
      }));

      self.postMessage({ status: "success", results: sanitizedResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});