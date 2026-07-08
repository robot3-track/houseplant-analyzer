import { env, pipeline, RawImage } from "@huggingface/transformers";

// Strictly allow local files only for 100% offline usage
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      if (!classifier) {
        self.postMessage({ status: "loading", message: "Loading offline vision pipeline..." });
        
        // Initialize the Hugging Face pipeline, targeting the uncompressed model.onnx file
        classifier = await pipeline("image-classification", "plant_analyzer_model", {
          quantized: false 
        });
      }

      self.postMessage({ status: "processing", message: "Analyzing specimen..." });

      // Cast the raw memory buffer back into a typed array and convert to a 3-channel RGB image
      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();

      // The pipeline natively accepts the RawImage object and processes the top 3 matches
      const results = await classifier(rawImage, { topk: 3 });

      self.postMessage({ status: "success", results: results });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});