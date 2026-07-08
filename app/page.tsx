'use client';

import { useState, useRef, useEffect } from 'react';

export default function PlantAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [status, setStatus] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (event) => {
      const { status, results, error } = event.data;
      if (error) setStatus(`Diagnostic failure: ${error}`);
      if (status === 'success') {
        setStatus('');
        setPredictions(results);
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const getAdvice = (p: any) => {
    if (p.label.includes("Invalid")) return "The model could not identify a valid plant. Please ensure the sample is clear, well-lit, and centered.";
    if (p.label.toLowerCase().includes("healthy")) return "Your plant appears to be in good condition. Continue your current care routine.";
    return `This sample shows signs of ${p.label.replace(/[:_]/g, ' ')}. We recommend isolating the plant and consulting a nursery for treatment.`;
  };

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (videoRef.current) { videoRef.current.srcObject = stream; setStreamActive(true); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && workerRef.current) {
      const reader = new FileReader();
      reader.onload = (e) => workerRef.current!.postMessage({ image: e.target?.result });
      reader.readAsDataURL(file);
    }
  };

  return (
    <main className="max-w-6xl mx-auto min-h-screen bg-[#FBFBFA] text-[#2C302E] px-6 py-12">
      <header className="mb-10"><h1 className="text-4xl font-light">Flora Diagnostics</h1></header>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <div className="aspect-[4/3] bg-stone-100 rounded-2xl overflow-hidden border border-stone-200">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <button onClick={startCamera} className="w-full bg-stone-900 text-stone-50 py-4 rounded-xl">Initialize Camera</button>
          <label className="cursor-pointer w-full text-center bg-stone-200 py-4 rounded-xl">Upload Image<input type="file" onChange={handleFileUpload} className="hidden"/></label>
        </div>

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          {predictions.map((p, idx) => (
            <div key={idx} className="flex flex-col py-4 border-b">
              <div className="flex justify-between items-center mb-2">
                <span className="capitalize text-sm font-medium">{p.label.replace(/[:_]/g, ' ')}</span>
                <span className="text-xs font-mono font-bold text-emerald-800">{(p.score * 100).toFixed(0)}%</span>
              </div>
              {idx === 0 && <p className="text-xs text-stone-500 italic font-serif bg-stone-50 p-2 rounded">{getAdvice(p)}</p>}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}