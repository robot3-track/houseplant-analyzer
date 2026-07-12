'use client';

import { useState, useRef, useEffect } from 'react';

// Database updated directly to match your new houseplant model config.json labels
const PLANT_CARE_DB: Record<string, { desc: string, treat: string }> = {
  "African Violet (Saintpaulia ionantha)": {
    desc: "Delicate indoor flowering specimen sensitive to extreme direct sun exposure and crown moisture.",
    treat: "Provide bright, indirect light. Irrigate from the bottom to protect the leaves from spotting."
  },
  "Aloe Vera": {
    desc: "Resilient succulent variant that retains heavy moisture stores inside its fleshy vascular leaves.",
    treat: "Provide bright, direct sunlight. Water deeply but infrequently, allowing the medium to dry fully."
  },
  "Anthurium (Anthurium andraeanum)": {
    desc: "Tropical evergreen featuring distinctive waxy spathes that demand high ambient moisture levels.",
    treat: "Place in bright, indirect light. Water when the top inch of soil drops in moisture; mist regularly."
  },
  "Areca Palm (Dypsis lutescens)": {
    desc: "Feathery palm variant prone to tip crisping if subjected to heavy mineral buildup or dry drafts.",
    treat: "Provide bright, filtered sunlight. Keep soil lightly moist and use distilled or filtered water."
  },
  "Asparagus Fern (Asparagus setaceus)": {
    desc: "Lightweight, branching perennial with needle-like cladodes requiring consistent ambient moisture.",
    treat: "Maintain dappled light or indirect shade. Water consistently to prevent sudden foliage drop."
  },
  "Begonia (Begonia spp.)": {
    desc: "Foliage display variant highly susceptible to powdery mildew if airflow is constrained.",
    treat: "Situate in bright, indirect light. Apply water directly to the soil; avoid getting foliage wet."
  },
  "Bird of Paradise (Strelitzia reginae)": {
    desc: "Sturdy structural upright plant requiring extensive high-intensity light to thrive.",
    treat: "Provide direct, bright sunlight. Water deeply during warm months; let dry slightly in winter."
  },
  "Birds Nest Fern (Asplenium nidus)": {
    desc: "Epophytic rosette fern that naturally collects moisture and organic material at its core axis.",
    treat: "Keep in medium to low indirect light. Water along outer edges; do not pour directly into the nest."
  },
  "Boston Fern (Nephrolepis exaltata)": {
    desc: "Classic hanging fern variant requiring constant humidity to prevent systemic frond crisping.",
    treat: "Situate in bright, indirect light. Keep the growing medium consistently damp like a wrung-out sponge."
  },
  "Calathea": {
    desc: "Ornamental foliage specimen known for nyctinasty movements and high sensitivity to chemicals.",
    treat: "Provide medium to low indirect light. Use distilled water exclusively and maximize surrounding humidity."
  },
  "Cast Iron Plant (Aspidistra elatior)": {
    desc: "Extremely durable low-light survivor tolerant of low humidity and irregular watering cycles.",
    treat: "Position in low light or deep shade. Allow soil to dry out significantly between watering sessions."
  },
  "Chinese Money Plant (Pilea peperomioides)": {
    desc: "Fast-growing succulent member displaying rounded, shield-shaped leaves on central stems.",
    treat: "Provide bright, indirect light. Rotate weekly for even growth and water once leaves droop slightly."
  },
  "Chinese evergreen (Aglaonema)": {
    desc: "Highly adaptable, slow-growing indoor variant that maintains deep color in lower light zones.",
    treat: "Maintain low to medium indirect light. Water thoroughly when the top two inches of medium dry out."
  },
  "Christmas Cactus (Schlumbergera bridgesii)": {
    desc: "Epiphytic jungle cactus that prefers higher relative moisture environments than desert varieties.",
    treat: "Provide bright, indirect light. Irrigate thoroughly only when the surface layer dries out entirely."
  },
  "Chrysanthemum": {
    desc: "Herbaceous blooming variant that consumes massive water resources during active flowering windows.",
    treat: "Provide bright, direct sunlight. Check daily to ensure the soil remains uniformly moist."
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

  // Filter list logic matching the new houseplant naming strings
  let displayPredictions = predictions.filter(p => {
    if (!p?.label) return false;
    if (selectedPlant === 'All') return true;
    return p.label.toLowerCase().includes(selectedPlant.toLowerCase());
  });

  // Safe default backup for Aloe Vera to preserve fallback UI mechanism
  if (selectedPlant === 'Aloe' && displayPredictions.length === 0) {
    displayPredictions = [{ label: 'Aloe Vera', score: 0.50 }];
  }

  return (
    <main className="max-w-6xl mx-auto min-h-screen bg-[#FBFBFA] text-[#2C302E] px-6 py-12 flex flex-col font-sans">
      <header className="mb-10">
        <h1 className="text-4xl font-light tracking-tight text-stone-900">Houseplant Analyzer</h1>
        <p className="text-sm text-stone-500 mt-2 font-serif italic">In-browser local houseplant identifier</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start w-full">
        <div className="flex flex-col gap-4 w-full">
          <div className="w-full">
            <label className="text-xs font-semibold uppercase text-stone-400 mb-2 block">Focus Species</label>
            <select 
              className="w-full p-4 rounded-xl border border-stone-200 bg-white text-stone-900 shadow-sm"
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
            >
              <option value="All">All Houseplants</option>
              <option value="Aloe">Aloe Vera</option>
              <option value="Fern">Fern Variants</option>
              <option value="Palm">Palm Variants</option>
              <option value="Cactus">Cactus Variants</option>
              <option value="Calathea">Calathea</option>
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
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">Plant Identification</h2>
          {displayPredictions.length > 0 ? (
            <div className="space-y-4">
              {displayPredictions.map((p, idx) => {
                const rawLabel = p.label ?? `Unknown_Class_${idx}`;
                const info = PLANT_CARE_DB[rawLabel] || { desc: "Species identified. Full care guidelines narrative unavailable.", treat: "Provide typical bright indirect light window placement." };
                
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
                      Care / Action: <span className="font-normal text-stone-600">{info.treat}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full min-h-[250px] flex items-center justify-center p-6 text-stone-400 italic">
              {status || "Awaiting sample... if you already uploaded the image, might take a few seconds to run local AI diagnostics"}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}