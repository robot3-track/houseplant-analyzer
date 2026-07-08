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
      if (!processor || !model) {
        self.postMessage({ status: "loading", message: "Loading offline vision engine..." });
        
        processor = await AutoProcessor.from_pretrained("plant_analyzer_model");
        model = await AutoModelForImageClassification.from_pretrained("plant_analyzer_model", {
          quantized: false 
        });
      }

      self.postMessage({ status: "processing", message: "Normalizing cellular data..." });

      // Cast the raw memory buffer back into a typed array and convert to a 3-channel RGB image
      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      const inputs = await processor(rawImage);

      self.postMessage({ status: "processing", message: "Running inference..." });

      // Get the raw mathematical outputs (logits) directly from the model
      const { logits } = await model(inputs);
      
      // Calculate Softmax probabilities
      const maxLogit = Math.max(...logits.data);
      const scores = logits.data.map(l => Math.exp(l - maxLogit));
      const sumScores = scores.reduce((a, b) => a + b, 0);
      const probabilities = scores.map(s => s / sumScores);

      // Fallback safely if config.json is still missing the id2label mapping
      const id2label = model.config.id2label || {};

      // Map the array index directly to the config labels, guaranteeing we never lose the ID
      const sortedResults = probabilities
        .map((score, index) => ({
          id: index,
          label: id2label[index] || `Unmapped Node ID: ${index}`,
          score: score
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Return top 5

      self.postMessage({ status: "success", results: sortedResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});