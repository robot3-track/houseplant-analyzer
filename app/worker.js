import { env, pipeline, RawImage } from "@huggingface/transformers";

// 1. Configuration
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/models/";

// Mapping IDs to names. If the model returns ID 0, it will display this name.
const LABEL_MAP = {
  0: "Powdery Mildew",
  1: "Healthy",
  2: "Early Blight",
  3: "Late Blight",
  4: "Septoria Leaf Spot"
};

let classifier = null;

self.addEventListener("message", async (event) => {
  const { action, rgbaData, width, height } = event.data;

  if (action === "analyze") {
    try {
      // 2. Initialize pipeline
      // We force 'task: "image-classification"' to bypass any tokenizer/NLP detection errors.
      if (!classifier) {
        classifier = await pipeline("image-classification", "plant_analyzer_model", { 
          quantized: true,
          task: "image-classification" 
        });
      }

      // 3. Image Processing
      // Convert raw buffer to Image, resize to model input (224x224), and normalize.
      // Normalization is critical. If your model was trained on ImageNet, it needs 
      // specific mean/std dev values.
      let img = new RawImage(new Uint8Array(rgbaData.buffer || rgbaData), width, height, 4).rgb();
      img = img.resize(224, 224);

      // 4. Inference
      // We set topk to 5 to check the distribution of all potential classes.
      const results = await classifier(img, { topk: 5 });

      // 5. DEBUGGING: Inspect the real output
      // This prints the exact objects to your browser console (F12).
      console.log("WORKER DEBUG - Raw Model Output:", JSON.stringify(results, null, 2));

      // 6. Sanitization & Mapping
      // If the model doesn't provide a 'label', we use our LABEL_MAP based on the index.
      const sanitizedResults = results.map((r, index) => ({
        id: index,
        // If the model didn't return a name, use our fallback map
        label: r.label || LABEL_MAP[index] || `Unknown Class ${index}`,
        score: r.score ?? 0,
        raw: r
      }));

      self.postMessage({ status: "success", results: sanitizedResults });

    } catch (error) {
      console.error("Worker Error:", error);
      self.postMessage({ status: "error", error: error.message });
    }
  }
});