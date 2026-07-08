"use client";

import { useEffect, useRef, useState } from "react";

interface ClassificationResult {
  label: string;
  score: number;
}

export default function PlantAnalyzer() {
  const workerRef = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready");
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  useEffect(() => {
    workerRef.current = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event) => {
      const { status: workerStatus, message, results: workerResults, error } = event.data;

      if (workerStatus === "loading" || workerStatus === "processing") {
        setStatus(message);
      } else if (workerStatus === "success") {
        setResults(workerResults);
        setStatus("Analysis complete!");
      } else if (workerStatus === "error") {
        setStatus(`Error: ${error}`);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      setImageSrc(null);
      setResults([]);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setStatus("Camera active...");
        }
      } catch (err) {
        setStatus("Could not access camera.");
        console.error(err);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setImageSrc(dataUrl);
        stopCamera();

        analyzeImage(context.getImageData(0, 0, canvas.width, canvas.height));
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopCamera();
    setResults([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const targetResult = e.target?.result as string;
      setImageSrc(targetResult);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          analyzeImage(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
      };
      img.src = targetResult;
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = (imageData: ImageData) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ image: imageData });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-white text-black p-12 sm:p-24 selection:bg-gray-100">
      {/* App Header Section */}
      <header className="text-center space-y-2 mb-10">
        <h1 className="text-4xl font-light tracking-tight text-black">
          Edge Plant Analyzer
        </h1>
        {/* Grey subtitle with slight cursive styling */}
        <p className="text-gray-400 text-base italic font-serif tracking-wide">
          100% offline diagnostic intelligence
        </p>
      </header>

      {/* Top Status Bar Indicator */}
      <div className="w-full max-w-xl border-b border-gray-200 pb-4 mb-8 flex justify-between items-center text-sm">
        <span className="text-gray-400">System Status:</span>
        <code className="font-mono bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700">
          {status}
        </code>
      </div>

      {/* Viewport Box */}
      <div className="relative flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 w-full max-w-xl aspect-video justify-center items-center shadow-sm">
        {isCameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {imageSrc && !isCameraActive && (
          <img
            src={imageSrc}
            alt="Upload preview"
            className="w-full h-full object-contain"
          />
        )}

        {!isCameraActive && !imageSrc && (
          <span className="text-gray-400 text-xs italic font-serif">
            No active stream or image asset selected
          </span>
        )}
      </div>

      {/* Action Controller Hub */}
      <div className="flex flex-row gap-4 my-8 text-xs font-mono">
        <button
          onClick={toggleCamera}
          className="rounded-lg border border-gray-200 px-4 py-2 bg-white hover:bg-gray-50 text-black shadow-sm transition-all"
        >
          {isCameraActive ? "Close Camera" : "Open Camera"}
        </button>

        {isCameraActive && (
          <button
            onClick={capturePhoto}
            className="rounded-lg border border-transparent px-4 py-2 bg-gray-900 text-white hover:bg-black shadow-sm transition-all"
          >
            Capture Frame
          </button>
        )}

        <label className="rounded-lg border border-gray-200 px-4 py-2 bg-white hover:bg-gray-50 text-black shadow-sm transition-all cursor-pointer">
          Upload Image
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Probability Array Feedback list */}
      <div className="w-full max-w-xl space-y-3">
        {results.map((res, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-white shadow-sm"
          >
            <span className="text-sm font-medium text-gray-900">
              {res.label}
            </span>
            <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
              {(res.score * 100).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}