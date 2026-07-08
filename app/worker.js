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
        self.postMessage({ status: "loading", message: "Loading offline vision engine (WASM)..." });
        
        processor = await AutoProcessor.from_pretrained("plant_analyzer_model");
        
        // FIX 1: Removed `device: "webgpu"`. 
        // WebGPU silent failures cause flat 0% outputs on unsupported hardware. 
        // This forces the stable WASM backend.
        model = await AutoModelForImageClassification.from_pretrained("plant_analyzer_model");
      }

      self.postMessage({ status: "processing", message: "Normalizing cellular data..." });

      // FIX 2: Explicitly cast the Clamped array from the canvas into a standard Uint8Array
      // Without this, the ONNX tensor might refuse to map the memory buffer, seeing only zeros.
      const pixelData = new Uint8Array(rgbaData.buffer || rgbaData);
      const rawImage = new RawImage(pixelData, width, height, 4).rgb();
      
      const inputs = await processor(rawImage);

      self.postMessage({ status: "processing", message: "Running inference..." });

      const { logits } = await model(inputs);
      
      // Calculate softmax probabilities
      const maxLogit = Math.max(...logits.data);
      const scores = logits.data.map(l => Math.exp(l - maxLogit));
      const sumScores = scores.reduce((a, b) => a + b, 0);
      const probabilities = scores.map(s => s / sumScores);

      const id2label = model.config.id2label;
      const sortedResults = Object.keys(id2label)
        .map(id => ({
          label: id2label[id],
          score: probabilities[parseInt(id)]
        }))
        .sort((a, b) => b.score - a.score);

      // Return the top 3 matches directly
      const finalResults = sortedResults.slice(0, 3);

      self.postMessage({ status: "success", results: finalResults });
    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});