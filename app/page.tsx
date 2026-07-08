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
    workerRef.current = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    workerRef.current.onmessage = (event) => {
      const { status, results, error } = event.data;
      if (status === "success") { setResults(results); setStatus("Analysis complete!"); }
      else if (status === "error") setStatus(`Error: ${error}`);
      else setStatus(status);
    };
    return () => workerRef.current?.terminate();
  }, []);

  const toggleCamera = async () => {
    if (isCameraActive) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setStatus("Camera active");
        }
      } catch (err) { setStatus("Camera access denied."); }
    }
  };

  const processImage = (imgElement: HTMLImageElement | HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 224; // Force ResNet-compatible size
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(imgElement, 0, 0, 224, 224);
    const imageData = ctx?.getImageData(0, 0, 224, 224);
    workerRef.current?.postMessage({ image: imageData });
    setStatus("Analyzing...");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImageSrc(img.src);
        processImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-white text-black p-12">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-light text-black">Edge Plant Analyzer</h1>
        <p className="text-gray-400 italic font-serif">100% offline diagnostic intelligence</p>
      </header>

      <div className="relative w-full max-w-xl aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-sm border border-gray-200">
        {isCameraActive ? (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : imageSrc ? (
          <img src={imageSrc} className="w-full h-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 italic font-serif">No media active</div>
        )}
      </div>

      <div className="flex gap-4 my-8 font-mono text-xs">
        <button onClick={toggleCamera} className="border p-2 rounded hover:bg-gray-50">{isCameraActive ? "Stop Camera" : "Open Camera"}</button>
        {isCameraActive && <button onClick={() => processImage(videoRef.current!)} className="bg-black text-white p-2 rounded">Capture & Analyze</button>}
        <label className="border p-2 rounded cursor-pointer hover:bg-gray-50">Upload Image<input type="file" onChange={handleFileUpload} className="hidden" /></label>
      </div>

      <div className="w-full max-w-xl space-y-2">
        {results.map((res, i) => (
          <div key={i} className="flex justify-between p-3 border-b text-sm">
            <span>{res.label}</span>
            <span className="font-bold">{(res.score * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </main>
  );
}