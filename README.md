# Houseplant Analyzer

This is an edge-computed indoor plant identification and care assistant that runs entirely within your web browser. It analyzes images locally on your device using ONNX runtime execution without transmitting any visual data to external servers, ensuring maximum privacy and zero latency.

Live website: https://houseplant-analyzer.vercel.app

## Features

* **Local Edge Inference:** Runs the vision classification pipeline directly on your CPU or GPU inside a browser tab thread, requiring no active network connections after the initial page load.
* **Privacy-First Engineering:** Your local camera feed and uploaded graphics assets are processed out of memory buffers and are never saved or sent to a server.
* **15 Household Varieties Covered:** Configured to instantly identify and provide custom light, watering, and toxicity details for popular indoor plants like Aloe Vera, Monstera, Calathea, and various Ferns/Palms.
* **Flexible Input Methods:** Capture live plant specimens using your device's environment camera stream or drop pre-existing files directly into the analyzer interface.

## Project Structure

* **`app/page.tsx`:** The core interface file managing camera stream lifecycles, file system buffers, and state rendering for the plant care metrics.
* **`app/worker.js`:** The background Web Worker thread using Transformers.js to execute local ONNX model predictions without blocking the main UI thread.
* **`public/models/plant_analyzer_model/`:** The local storage structure containing the web-ready quantized weights (`onnx/model_quantized.onnx`), token configuration, and structural feature extractors.