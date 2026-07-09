import { env, pipeline, RawImage } from "@huggingface/transformers";

// 1. Force the environment to look only in your local public/models directory
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      // 2. Explicitly define the pipeline as an image-classification task.
      // This prevents the library from guessing (incorrectly) that it is an NLP model.
      if (!classifier) {
        classifier = await pipeline("image-classification", "plant_analyzer_model", { 
          quantized: true,
          task: "image-classification" // THIS IS THE FIX: Forces the pipeline type
        });
      }

      // 3. Process the pixel data
      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      // 4. Run inference
      const results = await classifier(rawImage, { topk: 5 });

      // 5. Output for UI and Debug
      console.log("WORKER DEBUG - Results:", JSON.stringify(results, null, 2));

      self.postMessage({ 
        status: "success", 
        results: results 
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