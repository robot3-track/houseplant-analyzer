import { env, AutoProcessor, AutoModelForImageClassification, RawImage } from "@huggingface/transformers";

// Strictly allow local files only for 100% offline usage
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let processor = null;
let model = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      // 1. Initialize components individually to completely bypass tokenizers
      if (!processor || !model) {
        self.postMessage({ status: "loading", message: "Loading local offline vision engine..." });
        
        processor = await AutoProcessor.from_pretrained("plant_analyzer_model");
        model = await AutoModelForImageClassification.from_pretrained("plant_analyzer_model", {
          device: "webgpu"
        });
      }

      self.postMessage({ status: "processing", message: "Analyzing cell structures..." });

      // 2. Instantiate RawImage directly from raw uncompressed RGBA pixel arrays
      const rawImage = new RawImage(rgbaData, width, height, 4).rgb();
      const inputs = await processor(rawImage);

      // 3. Run direct inference through the model weights
      const { logits } = await model(inputs);
      
      // 4. Apply Softmax for accurate percentages and fix negative values
      const maxLogit = Math.max(...logits.data);
      const scores = logits.data.map(l => Math.exp(l - maxLogit));
      const sumScores = scores.reduce((a, b) => a + b, 0);
      const probabilities = scores.map(s => s / sumScores);

      // 5. Decode the raw outputs manually using your config.json labels
      const id2label = model.config.id2label;

      // Sort the outputs to find the top matches
      const sortedResults = Object.keys(id2label)
        .map(id => ({
          label: id2label[id],
          score: probabilities[parseInt(id)]
        }))
        .sort((a, b) => b.score - a.score);

      // 6. Return top 3 predictions directly without truncating via arbitrary cutoffs
      const finalResults = sortedResults.slice(0, 3);

      self.postMessage({ status: "success", results: finalResults });
    } catch (error) {
      self.postMessage({ status: "error", error: `Offline pipeline execution failed: ${error.message}` });
    }
  }
});