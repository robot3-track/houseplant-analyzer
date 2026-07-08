import { env, AutoProcessor, AutoModelForImageClassification, RawImage } from "@huggingface/transformers";

// Strictly allow local files only for 100% offline usage
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let processor = null;
let model = null;

self.addEventListener("message", async (event) => {
  const { image } = event.data;

  try {
    // 1. Initialize components individually to completely bypass tokenizers
    if (!processor || !model) {
      self.postMessage({ status: "loading", message: "Loading local offline vision engine..." });
      
      processor = await AutoProcessor.from_pretrained("plant_analyzer_model");
      model = await AutoModelForImageClassification.from_pretrained("plant_analyzer_model", {
        device: "webgpu"
      });
    }

    self.postMessage({ status: "processing", message: "Processing image arrays..." });

    // 2. Read the image data and run it through the image preprocessor config
    const rawImage = await RawImage.read(image);
    const inputs = await processor(rawImage);

    self.postMessage({ status: "processing", message: "Analyzing cell structures..." });

    // 3. Run direct inference through the model weights
    const { logits } = await model(inputs);
    
    // 4. Apply Softmax for accurate percentages and fix negative values[cite: 2]
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

    // 6. Confidence threshold check: adjusted to 0.05 (5%) to be more permissive[cite: 2]
    // Log for debugging if needed: console.log("Raw Model Predictions:", sortedResults);
    const topResult = sortedResults[0];
    const finalResults = topResult.score < 0.05 
      ? [{ label: "Invalid/Unrecognized Sample", score: 0 }] 
      : sortedResults.slice(0, 3);

    self.postMessage({ status: "success", results: finalResults });
  } catch (error) {
    self.postMessage({ status: "error", error: `Offline pipeline execution failed: ${error.message}` });
  }
});