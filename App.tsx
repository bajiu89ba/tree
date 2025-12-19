import React, { useState, useEffect, useRef, useCallback } from 'react';
import Scene3D, { Scene3DHandle } from './components/Scene3D';
import { OverlayUI } from './components/OverlayUI';
import Webcam from './components/Webcam';
import { FontStyleKey, ParticleConfig, SceneMode, StoredPhoto, TextConfig } from './types';
import * as DB from './services/dbService';

// Font styles map to match the CSS definitions
const FONT_STYLES: Record<FontStyleKey, { font: string; spacing: string; shadow: string; transform: string }> = {
  style1: { font: "'Ma Shan Zheng', cursive", spacing: "4px", shadow: "2px 2px 8px rgba(180,50,50,0.8)", transform: "none" },
  style2: { font: "'Cinzel', serif", spacing: "6px", shadow: "0 0 20px rgba(255,215,0,0.5)", transform: "none" },
  style3: { font: "'Great Vibes', cursive", spacing: "1px", shadow: "0 0 15px rgba(255,200,255,0.7)", transform: "none" },
  style4: { font: "'Monoton', cursive", spacing: "1px", shadow: "0 0 10px #fff", transform: "none" },
  style5: { font: "'Abril Fatface', cursive", spacing: "0px", shadow: "0 5px 15px rgba(0,0,0,0.8)", transform: "none" }
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [deleteManagerOpen, setDeleteManagerOpen] = useState(false);
  
  // Scene Config
  const [mode, setMode] = useState<SceneMode>('TREE');
  const [textConfig, setTextConfig] = useState<TextConfig>({
    line1: 'Merry',
    line2: 'Christmas',
    fontKey: 'style1',
    size: 100,
    color: '#fceea7'
  });
  const [particleConfig, setParticleConfig] = useState<ParticleConfig>({
    treeCount: 1500,
    dustCount: 2500,
    snowCount: 1500,
    snowSize: 0.12,
    snowSpeed: 3.5
  });

  // State
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [manualRotation, setManualRotation] = useState({ x: 0, y: 0 });
  const [gestureState, setGestureState] = useState({ detected: false, x: 0, y: 0 });
  
  // Refs
  const sceneRef = useRef<Scene3DHandle>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const [musicPlaying, setMusicPlaying] = useState(false);

  // Load Data on Mount
  useEffect(() => {
    const init = async () => {
      try {
        const loadedPhotos = await DB.loadPhotosFromDB();
        setPhotos(loadedPhotos);
        
        const loadedMusic = await DB.loadMusicFromDB();
        if (loadedMusic) {
          audioRef.current.src = URL.createObjectURL(loadedMusic);
          audioRef.current.loop = true;
        }

        // Init Default Photo if empty
        if (loadedPhotos.length === 0) {
            const c = document.createElement('canvas'); c.width=512; c.height=512;
            const x = c.getContext('2d');
            if(x){
               x.fillStyle='#050505'; x.fillRect(0,0,512,512);
               x.strokeStyle='#eebb66'; x.lineWidth=15; x.strokeRect(20,20,472,472);
               x.font='500 60px Times New Roman'; x.fillStyle='#eebb66'; x.textAlign='center';
               x.fillText("JOYEUX",256,230); x.fillText("NOEL",256,300);
               const defData = c.toDataURL();
               const id = await DB.savePhotoToDB(defData);
               setPhotos([{id, data: defData}]);
            }
        }
      } catch (e) {
        console.error("Initialization error", e);
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };
    init();
  }, []);

  // Handlers
  const handleFileUpload = async (files: FileList) => {
    const newPhotos: StoredPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        await new Promise<void>(resolve => {
            reader.onload = async (ev) => {
                if(ev.target?.result) {
                    const base64 = ev.target.result as string;
                    const id = await DB.savePhotoToDB(base64);
                    newPhotos.push({id, data: base64});
                }
                resolve();
            }
            reader.readAsDataURL(file);
        });
    }
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleMusicUpload = (file: File) => {
     DB.saveMusicToDB(file);
     audioRef.current.src = URL.createObjectURL(file);
     audioRef.current.play().then(() => setMusicPlaying(true)).catch(console.error);
  };

  const toggleMusic = () => {
    if(!audioRef.current.src) return alert("Please upload music first.");
    if(musicPlaying) { audioRef.current.pause(); setMusicPlaying(false); }
    else { audioRef.current.play(); setMusicPlaying(true); }
  };

  const handleDeletePhoto = async (id: string) => {
      await DB.deletePhotoFromDB(id);
      setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleClearPhotos = async () => {
      if(window.confirm("Delete all photos?")) {
          await DB.clearPhotosDB();
          setPhotos([]);
      }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      
      const key = e.key.toLowerCase();
      if(key === 'h') setUiVisible(v => !v);
      if(e.code === 'Space') { e.preventDefault(); setMode('TREE'); }
      if(key === 'z') setMode('SCATTER');
      if(key === 'x') sceneRef.current?.triggerGrab();
      
      if(e.code === 'ArrowUp') setManualRotation({x: -1, y: 0});
      if(e.code === 'ArrowDown') setManualRotation({x: 1, y: 0});
      if(e.code === 'ArrowLeft') setManualRotation({x: 0, y: -1});
      if(e.code === 'ArrowRight') setManualRotation({x: 0, y: 1});
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) setManualRotation({x:0, y:0});
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKey);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Title Dragging
  const titleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({x:0, y:0});

  const startDrag = (e: React.MouseEvent) => {
      if(!titleRef.current) return;
      const rect = titleRef.current.getBoundingClientRect();
      setDragOffset({x: e.clientX - rect.left, y: e.clientY - rect.top});
      setIsDragging(true);
  };

  const onDrag = useCallback((e: MouseEvent) => {
      if(isDragging && titleRef.current) {
          titleRef.current.style.left = `${e.clientX - dragOffset.x}px`;
          titleRef.current.style.top = `${e.clientY - dragOffset.y}px`;
          titleRef.current.style.transform = 'none';
      }
  }, [isDragging, dragOffset]);

  useEffect(() => {
      if(isDragging) window.addEventListener('mousemove', onDrag);
      else window.removeEventListener('mousemove', onDrag);
      
      const stopDrag = () => setIsDragging(false);
      window.addEventListener('mouseup', stopDrag);
      return () => {
          window.removeEventListener('mousemove', onDrag);
          window.removeEventListener('mouseup', stopDrag);
      };
  }, [isDragging, onDrag]);

  // Derived Text Style
  const activeFont = FONT_STYLES[textConfig.fontKey];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505] text-white">
      {/* 3D Scene */}
      <Scene3D 
        ref={sceneRef}
        particleConfig={particleConfig}
        mode={mode}
        manualRotation={manualRotation}
        gestureState={gestureState}
        photos={photos}
        onGrabComplete={(success) => setMode(success ? 'FOCUS' : 'SCATTER')}
        onModeChange={setMode}
      />

      {/* Loading Screen */}
      <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
         <div className="w-12 h-12 border border-[#d4af37]/20 border-t-2 border-t-[#d4af37] rounded-full animate-spin"></div>
         <div className="mt-6 text-[#d4af37] text-xs tracking-[0.3em] font-serif opacity-80">SYSTEM INITIALIZING</div>
      </div>

      {/* Draggable Title */}
      <div 
        ref={titleRef}
        onMouseDown={startDrag}
        className="absolute top-[10%] left-1/2 -translate-x-1/2 z-40 cursor-move select-none text-center"
        style={{ fontFamily: activeFont.font }}
      >
        <h1 
          className="whitespace-nowrap transition-all duration-200"
          style={{ 
              fontSize: `${textConfig.size * 0.48}px`, 
              color: textConfig.color,
              letterSpacing: activeFont.spacing,
              textShadow: activeFont.shadow,
              textTransform: activeFont.transform as any
          }}
        >
            {textConfig.line1}
        </h1>
        <h1 
          className="whitespace-nowrap transition-all duration-200"
           style={{ 
              fontSize: `${textConfig.size * 0.48}px`, 
              color: textConfig.color,
              letterSpacing: activeFont.spacing,
              textShadow: activeFont.shadow,
              textTransform: activeFont.transform as any
          }}
        >
            {textConfig.line2}
        </h1>
      </div>

      {/* Top Right Buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-50">
        <button onClick={() => !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen()} className="backdrop-blur-xl bg-gray-900/70 border border-white/10 rounded px-3 py-1.5 text-[#d4af37] text-[10px] uppercase font-bold hover:bg-white/10">
          ⛶ Fullscreen
        </button>
        <button onClick={() => setUiVisible(!uiVisible)} className="backdrop-blur-xl bg-gray-900/70 border border-white/10 rounded px-3 py-1.5 text-[#d4af37] text-[10px] uppercase font-bold hover:bg-white/10">
          👁 Hide UI
        </button>
      </div>

      {/* Main UI */}
      <OverlayUI 
        visible={uiVisible}
        textConfig={textConfig} setTextConfig={setTextConfig}
        particleConfig={particleConfig} setParticleConfig={setParticleConfig}
        mode={mode} setMode={setMode}
        triggerGrab={() => sceneRef.current?.triggerGrab()}
        onManualRotate={(dir) => {
            if(dir === 'stop') setManualRotation({x:0, y:0});
            else if(dir === 'up') setManualRotation({x:-1, y:0});
            else if(dir === 'down') setManualRotation({x:1, y:0});
            else if(dir === 'left') setManualRotation({x:0, y:-1});
            else if(dir === 'right') setManualRotation({x:0, y:1});
        }}
        musicPlaying={musicPlaying}
        toggleMusic={toggleMusic}
        replayMusic={() => { audioRef.current.currentTime = 0; if(!musicPlaying) toggleMusic(); }}
        setVolume={(v) => { audioRef.current.volume = v/100; }}
        onFileUpload={handleFileUpload}
        onMusicUpload={handleMusicUpload}
        openDeleteManager={() => setDeleteManagerOpen(true)}
        toggleCamera={() => setCameraVisible(v => !v)}
        resetScene={() => sceneRef.current?.resetScene()}
      />

      {/* Webcam */}
      <Webcam 
        visible={cameraVisible}
        onGesture={(detected, x, y) => setGestureState({detected, x, y})}
      />

      {/* Gesture Hint */}
      <div className="absolute bottom-2 w-full text-center text-[#d4af37]/70 text-[10px] pointer-events-none z-10 drop-shadow-md">
         {mode === 'TREE' && "State: Aggregate (Tree)"}
         {mode === 'SCATTER' && "State: Scatter (Nebula)"}
         {mode === 'FOCUS' && "State: Focus Photo"}
      </div>

      {/* Delete Manager Modal */}
      {deleteManagerOpen && (
          <div className="absolute inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center">
              <h2 className="text-[#d4af37] text-xl font-serif tracking-widest mb-6">PHOTO LIBRARY</h2>
              <div className="flex flex-wrap gap-4 w-[70%] h-[60%] overflow-y-auto p-5 border border-[#d4af37]/30 bg-black/50 rounded-lg justify-center custom-scrollbar">
                  {photos.length === 0 && <div className="text-gray-500 self-center">No photos uploaded.</div>}
                  {photos.map(p => (
                      <div key={p.id} className="w-20 h-20 relative group border border-[#d4af37] hover:scale-110 hover:border-white transition-all cursor-pointer">
                          <img src={p.data} className="w-full h-full object-cover" alt="Memory" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id); }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-900 text-white rounded-full text-xs font-bold border border-white flex items-center justify-center hover:bg-red-700"
                          >X</button>
                      </div>
                  ))}
              </div>
              <div className="flex gap-4 mt-6">
                  <button onClick={handleClearPhotos} className="px-6 py-2 border border-red-800/50 text-red-300 rounded hover:bg-red-900/40 transition-colors uppercase text-xs font-bold">Clear All</button>
                  <button onClick={() => setDeleteManagerOpen(false)} className="px-6 py-2 border border-[#d4af37]/30 text-[#d4af37] rounded hover:bg-[#d4af37]/10 transition-colors uppercase text-xs font-bold">Close</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;