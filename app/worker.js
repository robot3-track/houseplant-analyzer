import { env, AutoProcessor, AutoModelForImageClassification, RawImage } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

let processor = null;
let model = null;

self.addEventListener("message", async (event) => {
  const { image } = event.data;
  try {
    if (!processor || !model) {
      self.postMessage({ status: "loading", message: "Loading local offline vision engine..." });
      processor = await AutoProcessor.from_pretrained("plant_analyzer_model");
      model = await AutoModelForImageClassification.from_pretrained("plant_analyzer_model", { device: "webgpu" });
    }

    const rawImage = await RawImage.read(image);
    const inputs = await processor(rawImage);
    const { logits } = await model(inputs);
    
    const maxLogit = Math.max(...logits.data);
    const scores = logits.data.map(l => Math.exp(l - maxLogit));
    const sumScores = scores.reduce((a, b) => a + b, 0);
    const probabilities = scores.map(s => s / sumScores);

    const id2label = model.config.id2label;
    const sortedResults = Object.keys(id2label)
      .map(id => ({ label: id2label[id], score: probabilities[parseInt(id)] }))
      .sort((a, b) => b.score - a.score);

    // Confidence threshold check[cite: 2]
    const topResult = sortedResults[0];
    const finalResults = topResult.score < 0.2 
      ? [{ label: "Invalid/Unrecognized Sample", score: 0 }] 
      : sortedResults.slice(0, 3);

    self.postMessage({ status: "success", results: finalResults });
  } catch (error) {
    self.postMessage({ status: "error", error: `${error.message}` });
  }
});