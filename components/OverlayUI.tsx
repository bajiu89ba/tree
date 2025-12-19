import React from 'react';
import { FontStyleKey, TextConfig, ParticleConfig, SceneMode } from '../types';

interface OverlayUIProps {
  visible: boolean;
  textConfig: TextConfig;
  setTextConfig: React.Dispatch<React.SetStateAction<TextConfig>>;
  particleConfig: ParticleConfig;
  setParticleConfig: React.Dispatch<React.SetStateAction<ParticleConfig>>;
  mode: SceneMode;
  setMode: (m: SceneMode) => void;
  triggerGrab: () => void;
  onManualRotate: (dir: 'up' | 'down' | 'left' | 'right' | 'stop') => void;
  musicPlaying: boolean;
  toggleMusic: () => void;
  replayMusic: () => void;
  setVolume: (v: number) => void;
  onFileUpload: (files: FileList) => void;
  onMusicUpload: (file: File) => void;
  openDeleteManager: () => void;
  toggleCamera: () => void;
  resetScene: () => void;
}

const GlassPanel = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`backdrop-blur-xl bg-gray-900/70 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl p-3 text-white ${className}`}>
    {children}
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1 mt-2">{children}</div>
);

const ElegantButton = ({ 
  children, 
  className = "", 
  active = false,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button 
    className={`
      relative overflow-hidden group
      border border-[#d4af37]/30 rounded px-2 py-1.5 
      text-[10px] uppercase font-bold tracking-wider
      transition-all duration-300 ease-out
      hover:bg-[#d4af37]/10 hover:border-[#fff1c1] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]
      active:scale-95
      ${active ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-white/5 text-[#d4af37]'}
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);

const InputGlass = ({ ...props }) => (
  <input 
    {...props} 
    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-[#eebb66] text-[10px] text-center focus:outline-none focus:border-[#d4af37] focus:bg-black/60 transition-colors"
  />
);

const RangeSlider = ({ ...props }) => (
  <input type="range" {...props} className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
);

export const OverlayUI: React.FC<OverlayUIProps> = ({
  visible,
  textConfig, setTextConfig,
  particleConfig, setParticleConfig,
  mode, setMode,
  triggerGrab,
  onManualRotate,
  musicPlaying, toggleMusic, replayMusic, setVolume,
  onFileUpload, onMusicUpload, openDeleteManager, toggleCamera, resetScene
}) => {
  
  if (!visible) return null;

  return (
    <>
      {/* Left Sidebar */}
      <div className="absolute top-4 left-4 w-[220px] h-[calc(100vh-32px)] flex flex-col gap-2 z-20 pointer-events-none origin-top-left scale-90 sm:scale-100 transition-transform">
        
        {/* Scene Config Panel */}
        <GlassPanel className="pointer-events-auto flex flex-col gap-1 overflow-y-auto max-h-[60%] custom-scrollbar">
          <div className="text-center text-[#fff1c1] text-sm font-bold border-b border-[#d4af37]/20 pb-1 mb-2 font-serif tracking-widest">SCENE CONFIG</div>
          
          <Label>Greeting Text</Label>
          <div className="flex flex-col gap-1">
             <InputGlass value={textConfig.line1} onChange={(e: any) => setTextConfig({...textConfig, line1: e.target.value})} placeholder="Line 1" />
             <InputGlass value={textConfig.line2} onChange={(e: any) => setTextConfig({...textConfig, line2: e.target.value})} placeholder="Line 2" />
          </div>

          <Label>Typography</Label>
          <select 
            value={textConfig.fontKey}
            onChange={(e: any) => setTextConfig({...textConfig, fontKey: e.target.value as FontStyleKey})}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-[#d4af37] text-[10px] text-center focus:outline-none"
          >
            <option value="style1">Ma Shan Zheng</option>
            <option value="style2">Cinzel Decorative</option>
            <option value="style3">Great Vibes</option>
            <option value="style4">Monoton Art</option>
            <option value="style5">Abril Fatface</option>
          </select>

          <Label>Style</Label>
          <div className="flex items-center gap-2">
             <RangeSlider min="50" max="250" value={textConfig.size} onChange={(e: any) => setTextConfig({...textConfig, size: Number(e.target.value)})} />
             <input type="color" value={textConfig.color} onChange={(e) => setTextConfig({...textConfig, color: e.target.value})} className="w-8 h-5 bg-transparent border-none cursor-pointer" />
          </div>

          <div className="mt-2 pt-2 border-t border-white/5">
             <Label>Ambience</Label>
             <div className="flex gap-2 mb-1">
               <ElegantButton onClick={toggleMusic} className="flex-grow text-xs">{musicPlaying ? 'Pause' : 'Play Music'}</ElegantButton>
               <ElegantButton onClick={replayMusic}>↻</ElegantButton>
             </div>
             <RangeSlider min="0" max="100" defaultValue="50" onChange={(e: any) => setVolume(Number(e.target.value))} />
          </div>

          <div className="mt-2 pt-2 border-t border-white/5">
             <Label>Particles</Label>
             <div className="space-y-2 pr-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                <div>
                   <span className="text-[9px] text-gray-500">Tree Density</span>
                   <RangeSlider min="500" max="3000" value={particleConfig.treeCount} onChange={(e: any) => setParticleConfig({...particleConfig, treeCount: Number(e.target.value)})} />
                </div>
                <div>
                   <span className="text-[9px] text-gray-500">Stardust</span>
                   <RangeSlider min="500" max="5000" value={particleConfig.dustCount} onChange={(e: any) => setParticleConfig({...particleConfig, dustCount: Number(e.target.value)})} />
                </div>
                <div>
                   <span className="text-[9px] text-gray-500">Snow Count</span>
                   <RangeSlider min="0" max="3000" step="100" value={particleConfig.snowCount} onChange={(e: any) => setParticleConfig({...particleConfig, snowCount: Number(e.target.value)})} />
                </div>
                <div>
                   <span className="text-[9px] text-gray-500">Snow Speed</span>
                   <RangeSlider min="1.0" max="8.0" step="0.5" value={particleConfig.snowSpeed} onChange={(e: any) => setParticleConfig({...particleConfig, snowSpeed: Number(e.target.value)})} />
                </div>
             </div>
             <ElegantButton onClick={resetScene} className="w-full mt-2">⚡ Rebuild Scene</ElegantButton>
          </div>
        </GlassPanel>

        {/* Interaction Panel */}
        <GlassPanel className="pointer-events-auto">
            <div className="text-center text-[#fff1c1] text-xs font-bold border-b border-[#d4af37]/20 pb-1 mb-2 font-serif tracking-widest">CONTROLS</div>
            <Label>Mode</Label>
            <div className="flex gap-1 mb-2">
                <ElegantButton className="flex-1" active={mode === 'TREE'} onClick={() => setMode('TREE')}>Tree (Space)</ElegantButton>
                <ElegantButton className="flex-1" active={mode === 'SCATTER'} onClick={() => setMode('SCATTER')}>Scatter (Z)</ElegantButton>
            </div>
            <ElegantButton className="w-full mb-3" active={mode === 'FOCUS'} onClick={triggerGrab}>Focus Photo (X)</ElegantButton>
            
            <Label>Manual Rotate</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
                <div/>
                <ElegantButton onMouseDown={() => onManualRotate('up')} onMouseUp={() => onManualRotate('stop')} onMouseLeave={() => onManualRotate('stop')}>▲</ElegantButton>
                <div/>
                <ElegantButton onMouseDown={() => onManualRotate('left')} onMouseUp={() => onManualRotate('stop')} onMouseLeave={() => onManualRotate('stop')}>◀</ElegantButton>
                <ElegantButton onClick={() => onManualRotate('stop')} className="text-[8px]">●</ElegantButton>
                <ElegantButton onMouseDown={() => onManualRotate('right')} onMouseUp={() => onManualRotate('stop')} onMouseLeave={() => onManualRotate('stop')}>▶</ElegantButton>
                <div/>
                <ElegantButton onMouseDown={() => onManualRotate('down')} onMouseUp={() => onManualRotate('stop')} onMouseLeave={() => onManualRotate('stop')}>▼</ElegantButton>
                <div/>
            </div>
        </GlassPanel>
      </div>

      {/* Bottom Left Panel - Resources */}
      <div className="absolute bottom-4 left-4 w-[220px] pointer-events-none origin-bottom-left scale-90 sm:scale-100 transition-transform z-20">
         <GlassPanel className="pointer-events-auto grid grid-cols-2 gap-2">
            <div className="col-span-2 text-center text-[#fff1c1] text-[10px] font-bold border-b border-[#d4af37]/20 pb-1 mb-1 font-serif tracking-widest">RESOURCES</div>
            <ElegantButton className="col-span-1">
                + Photo
                <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && onFileUpload(e.target.files)} />
            </ElegantButton>
            <ElegantButton onClick={openDeleteManager}>Manage</ElegantButton>
            <ElegantButton className="col-span-1">
                ♫ Music
                <input type="file" accept=".mp3,audio/mpeg" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && onMusicUpload(e.target.files[0])} />
            </ElegantButton>
            <ElegantButton onClick={toggleCamera}>Toggle Cam</ElegantButton>
         </GlassPanel>
      </div>
    </>
  );
}