'use client';

import { useState, useRef, useEffect } from 'react';

// Database for diagnostic information mapped directly to your config.json labels
const DISEASE_INFO: Record<string, { desc: string, treat: string }> = {
  "Corn___Common_Rust": {
    desc: "A fungal disease causing reddish-brown pustules on the leaf surface.",
    treat: "Apply a preventative fungicide and improve air circulation."
  },
  "Corn___Gray_Leaf_Spot": {
    desc: "Fungal patches forming long, rectangular lesions parallel to leaf veins.",
    treat: "Maximize crop rotation and utilize resistant hybrids."
  },
  "Corn___Healthy": {
    desc: "Foliage shows optimal cell structure and clear vascular pathways.",
    treat: "No treatment needed. Maintain standard irrigation cycles."
  },
  "Potato___Early_Blight": {
    desc: "Concentric rings forming target-like dark spots on older leaves.",
    treat: "Apply copper-based fungicides early in the seasonal cycle."
  },
  "Potato___Healthy": {
    desc: "Foliage shows clean turgor pressure with no fungal lesions.",
    treat: "No treatment needed. Monitor soil moisture levels closely."
  },
  "Potato___Late_Blight": {
    desc: "Aggressive, water-soaked dark lesions that progress to black necrosis.",
    treat: "Remove affected foliage immediately; avoid overhead watering lines."
  },
  "Rice___Brown_Spot": {
    desc: "Fungal spots with yellow halos evenly distributed on leaf surfaces.",
    treat: "Improve soil nutrient balance and optimize potassium levels."
  },
  "Rice___Healthy": {
    desc: "Foliage presents uniform green hues and clear cellular rows.",
    treat: "No treatment needed. Continue standard paddi flooding schedules."
  },
  "Rice___Leaf_Blast": {
    desc: "Spindle-shaped elliptical lesions with gray centers and dark borders.",
    treat: "Avoid excessive nitrogen fertilizers and implement systemic fungicides."
  },
  "Wheat___Brown_Rust": {
    desc: "Small, orange-brown pustules scattering across the leaf blades.",
    treat: "Utilize rust-resistant seed variants in subsequent rotations."
  },
  "Wheat___Healthy": {
    desc: "Vibrant, green stalks with clear and robust leaf blades.",
    treat: "No treatment needed. Monitor for changes in ambient humidity."
  },
  "Wheat___Yellow_Rust": {
    desc: "Distinct yellow pustules forming linear stripes along leaf veins.",
    treat: "Apply target triazole fungicides immediately upon discovery."
  },
  "Rice_Bacterial Blight Disease": {
    desc: "Bacterial wilting causing systematic yellowing starting at leaf tips.",
    treat: "Maintain strict field drainage control to lower transmission rates."
  },
  "Rice_Blast Disease": {
    desc: "Severe fungal blast nodes causing lesions across stalks and leaves.",
    treat: "Apply specific silicon soil treatments and adjust water heights."
  },
  "Rice_Brown Spot Disease": {
    desc: "Fungal spotting on leaves that diminishes grain size and total yield.",
    treat: "Use certified clean seeds and treat them before planting phases."
  },
  "Rice_False Smut Disease": {
    desc: "Chlamydospores that transform grain kernels into green velvety masses.",
    treat: "Manually remove infected heads and apply pre-flowering fungicide."
  },
  "sugarcane_Bacterial Blight": {
    desc: "Severe vascular streaking leading to localized cellular necrosis.",
    treat: "Source clean seed canes and practice rigorous tool sanitation."
  },
  "sugarcane_Healthy": {
    desc: "Stalks and leaves demonstrate robust density and deep coloring.",
    treat: "No treatment needed. Keep up standard cane field upkeep."
  },
  "sugarcane_Red Rot": {
    desc: "Internal red discoloration with white patches inside split stalks.",
    treat: "Immediately rotate out infected crop fields and plow under trash."
  }
};

export default function PlantAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<string>('All');

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
        // Safely strip out explicit 'Invalid' markers if they match your config index 3
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

  const getAnalysisBuffer = (source: HTMLVideoElement | HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 224; 
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, 224, 224);
    return new Uint8Array(ctx.getImageData(0, 0, 224, 224).data.buffer);
  };

  const captureAndAnalyze = () => {
    if (!videoRef.current || !workerRef.current) return;

    const rgbaData = getAnalysisBuffer(videoRef.current);
    if (rgbaData) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setPreviewImage(canvas.toDataURL('image/jpeg'));
      
      videoRef.current.pause();
      setCameraPaused(true);

      workerRef.current.postMessage({
        action: 'analyze',
        rgbaData: rgbaData,
        width: 224,
        height: 224
      }, [rgbaData.buffer]);

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

  // Case-insensitive filtering logic that captures all variations (e.g., sugarcane vs Corn)
  const filteredPredictions = predictions.filter(p => {
    if (!p?.label) return false;
    if (selectedPlant === 'All') return true;
    return p.label.toLowerCase().includes(selectedPlant.toLowerCase());
  });

  return (
    <main className="max-w-6xl mx-auto min-h-screen bg-[#FBFBFA] text-[#2C302E] px-6 py-12 flex flex-col font-sans">
      <header className="mb-10">
        <h1 className="text-4xl font-light tracking-tight text-stone-900">Flora Diagnostics</h1>
        <p className="text-sm text-stone-500 mt-2 font-serif italic">In-browser local plant health scanner.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start w-full">
        <div className="flex flex-col gap-4 w-full">
          {/* Dynamic Focus Selection */}
          <div className="w-full">
            <label className="text-xs font-semibold uppercase text-stone-400 mb-2 block">Focus Species</label>
            <select 
              className="w-full p-4 rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm"
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
            >
              <option value="All">All Crops</option>
              <option value="Corn">Corn</option>
              <option value="Potato">Potato</option>
              <option value="Rice">Rice</option>
              <option value="Wheat">Wheat</option>
              <option value="Sugarcane">Sugarcane</option>
            </select>
          </div>

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
                Take a Picture
              </button>
            ) : (
              <>
                {(cameraPaused || previewImage) && (
                  <button onClick={resumeCameraStream} className="w-full bg-stone-600 text-stone-50 py-3 rounded-xl hover:bg-stone-700 transition-all">
                    Resume Live Camera
                  </button>
                )}
                <button onClick={captureAndAnalyze} className="w-full bg-emerald-800 text-stone-50 py-4 rounded-xl hover:bg-emerald-900 transition-all">
                  Evaluate Camera Sample
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
          {filteredPredictions.length > 0 ? (
            <div className="space-y-4">
              {filteredPredictions.map((p, idx) => {
                const rawLabel = p.label ?? `Unknown_Class_${idx}`;
                const info = DISEASE_INFO[rawLabel] || { desc: "Species identified. Full diagnostic narrative unavailable.", treat: "Consult local extension guidelines." };
                
                // Clean formatting transforms double/triple underscores to dashes and single underscores to spaces
                const cleanLabel = String(rawLabel)
                  .replace('___', ' - ')
                  .replace(/_/g, ' ');
                
                return (
                  <div key={idx} className="p-4 border border-stone-200 rounded-xl bg-stone-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-stone-900 capitalize">{cleanLabel}</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                        {typeof p.score === 'number' ? `${(p.score * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 italic">{info.desc}</p>
                    <p className="text-sm font-semibold text-stone-800">
                      Recommended Treatment: <span className="font-normal text-stone-600">{info.treat}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full min-h-[250px] flex items-center justify-center p-6 text-stone-400 italic">
              {status || "Awaiting sample (note to user: if you already inputted an image and there are no results, please check your filters)..."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}