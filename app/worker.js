import { env, pipeline, RawImage } from "@huggingface/transformers";

// Strictly enforce local models to prevent silent Hub fallbacks
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";

// Warm up the models immediately on worker bootup instead of waiting for the message
const primaryClassifierPromise = pipeline("image-classification", "plant_analyzer_model");
const secondaryClassifierPromise = pipeline("image-classification", "leaf_condition_model");

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      // Resolve the pre-warmed pipeline instances instantly
      const primaryClassifier = await primaryClassifierPromise;
      const secondaryClassifier = await secondaryClassifierPromise;

      if (!rgbaData || rgbaData.length === 0) {
        throw new Error("Input raw pixel array buffer is empty or missing.");
      }

      // CRITICAL FIX: Clone the data buffer for each pipeline. 
      // If they share the same RawImage, the preprocessors will mutate the data 
      // simultaneously and feed garbage to the secondary model.
      const buffer1 = new Uint8Array(rgbaData).slice();
      const buffer2 = new Uint8Array(rgbaData).slice();

      const image1 = new RawImage(buffer1, width, height, 4);
      const image2 = new RawImage(buffer2, width, height, 4);

      // Parallel execution is now isolated and safe
      const [primaryResults, secondaryResults] = await Promise.all([
        primaryClassifier(image1, { topk: 3 }),
        secondaryClassifier(image2, { topk: 3 })
      ]);

      self.postMessage({
        status: "success",
        results: {
          primary: primaryResults,
          secondary: secondaryResults
        }
      });

    } catch (error) {
      self.postMessage({ status: "error", error: error.message });
    }
  }
});