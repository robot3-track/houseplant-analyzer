import { env, pipeline, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      // Correctly initializes the local plant_analyzer_model folder setup
      if (!classifier) {
        classifier = await pipeline("image-classification", "plant_analyzer_model");
      }

      // Convert the raw data to a Uint8Array
      const pixelData = new Uint8Array(rgbaData);

      // Wrap the pixel data in a RawImage object
      const image = new RawImage(pixelData, width, height, 4);

      // Inference
      const results = await classifier(image, { 
        topk: 5,
      });

      // Ensure every result has a valid string label before sending it to the frontend
      const safeResults = results.map((r, index) => ({
        ...r,
        label: r.label !== undefined ? r.label : `Unknown_Class_${index}`
      }));

      // Post the safe results back to the main thread
      self.postMessage({ status: "success", results: safeResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});