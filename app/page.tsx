'use client';

import { useState, useRef, useEffect } from 'react';

export default function PlantAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { status, results, error } = event.data;
      
      if (error) {
        setStatus(`Diagnostic failure: ${error}`);
        return;
      }

      if (status === 'success') {
        setStatus('');
        // Filter out irrelevant labels if necessary
        const validPredictions = (results || []).filter((r: any) => r.label !== 'Invalid');
        setPredictions(validPredictions);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const startCamera = async () => {
    try {
      setPreviewImage(null);
      setCameraPaused(false);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
        setStatus('');
      }
    } catch (err) {
      setStatus('Please grant camera access to evaluate leaves.');
    }
  };

  const resumeCameraStream = () => {
    setPreviewImage(null);
    setCameraPaused(false);
    setStatus('');
    if (videoRef.current && streamActive) {
      videoRef.current.play().catch(() => {});
    } else {
      startCamera();
    }
  };

  // FIX: Explicitly return a standard Uint8Array to satisfy the Worker/ONNX Runtime
  const getAnalysisBuffer = (source: HTMLVideoElement | HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 224; 
    canvas.height = 224;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(source, 0, 0, 224, 224);
    const imageData = ctx.getImageData(0, 0, 224, 224);
    
    // Explicitly convert to Uint8Array to avoid "Unsupported object" errors
    return new Uint8Array(imageData.data.buffer);
  };

  const captureAndAnalyze = () => {
    if (!videoRef.current || !workerRef.current) return;

    const rgbaData = getAnalysisBuffer(videoRef.current);
    
    if (rgbaData) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      setPreviewImage(canvas.toDataURL('image/jpeg'));
      
      videoRef.current.pause();
      setCameraPaused(true);

      workerRef.current.postMessage({
        action: 'analyze',
        rgbaData: rgbaData, // This is now a clean Uint8Array
        width: 224,
        height: 224
      }, [rgbaData.buffer]); // Transfer the buffer

      setStatus('Analyzing captured frame...');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && workerRef.current) {
      setStatus('Loading upload file...');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const fileDataUrl = e.target?.result as string;
        setPreviewImage(fileDataUrl);
        setCameraPaused(false);
        setStreamActive(false); 
        
        const img = new Image();
        img.onload = () => {
          const rgbaData = getAnalysisBuffer(img);
          if (rgbaData) {
            workerRef.current!.postMessage({
              action: 'analyze',
              rgbaData: rgbaData,
              width: 224,
              height: 224
            }, [rgbaData.buffer]);
            setStatus('Analyzing file metrics...');
          }
        };
        img.src = fileDataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <main className="max-w-6xl mx-auto min-h-screen bg-[#FBFBFA] text-[#2C302E] px-6 py-12 flex flex-col font-sans">
      <header className="mb-10">
        <h1 className="text-4xl font-light tracking-tight text-stone-900">Flora Diagnostics</h1>
        <p className="text-sm text-stone-500 mt-2 font-serif italic">In-browser cellular pathology. Localized ViT inference.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start w-full">
        <div className="flex flex-col gap-4 w-full">
          <div className="relative w-full aspect-[4/3] bg-stone-100 rounded-2xl overflow-hidden border border-stone-200/60 shadow-sm flex items-center justify-center">
            {previewImage ? (
              <img src={previewImage} alt="Analysis Target" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            {!streamActive && !previewImage ? (
              <button onClick={startCamera} className="w-full bg-stone-900 text-stone-50 py-4 rounded-xl hover:bg-stone-800 transition-all">
                Initialize Viewport Stream
              </button>
            ) : (
              <>
                {(cameraPaused || previewImage) && (
                  <button onClick={resumeCameraStream} className="w-full bg-stone-600 text-stone-50 py-3 rounded-xl hover:bg-stone-700 transition-all">
                    Resume Live Camera
                  </button>
                )}
                <button onClick={captureAndAnalyze} className="w-full bg-emerald-800 text-stone-50 py-4 rounded-xl hover:bg-emerald-900 transition-all">
                  Evaluate Leaf Sample
                </button>
              </>
            )}

            <label className="cursor-pointer w-full text-center bg-stone-200 text-stone-800 py-4 rounded-xl hover:bg-stone-300 transition-all">
              Upload Image File
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <section className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-sm h-full">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">Diagnostic Assessment</h2>
          {predictions.length > 0 ? (
            <div className="space-y-4">
              {predictions.map((p, idx) => {
                const cleanLabel = p.label.replace('___', ' - ').replace(/_/g, ' ');
                return (
                  <div key={idx} className="p-4 border border-stone-200 rounded-xl bg-stone-50">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-stone-900">{cleanLabel}</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                        {(p.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full min-h-[250px] flex items-center justify-center p-6 text-stone-400 italic">
              {status || "Awaiting sample..."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}