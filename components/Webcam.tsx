import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface WebcamProps {
  onGesture: (detected: boolean, x: number, y: number) => void;
  visible: boolean;
}

const Webcam: React.FC<WebcamProps> = ({ onGesture, visible }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationId: number;
    let lastVideoTime = -1;

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        if (navigator.mediaDevices?.getUserMedia && videoRef.current) {
             const stream = await navigator.mediaDevices.getUserMedia({ video: true });
             videoRef.current.srcObject = stream;
             videoRef.current.addEventListener("loadeddata", predictWebcam);
             setLoaded(true);
        }
      } catch (err) {
        console.error("Webcam init error:", err);
      }
    };

    const predictWebcam = async () => {
      if (!videoRef.current || !canvasRef.current || !handLandmarker) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Draw video to canvas (mirrored)
      if (ctx) {
         ctx.save();
         ctx.scale(-1, 1);
         ctx.translate(-canvas.width, 0);
         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         ctx.restore();
      }

      // Detection
      if (video.currentTime !== lastVideoTime) {
         lastVideoTime = video.currentTime;
         const result = handLandmarker.detectForVideo(video, performance.now());
         
         if (result.landmarks && result.landmarks.length > 0) {
            setIsActive(true);
            const lm = result.landmarks[0];
            // Normalize for interaction: x is -1 to 1 (inverted due to mirror), y is -1 to 1
            // Landmark 9 is middle finger mcp (center of hand roughly)
            const x = (lm[9].x - 0.5) * 2; 
            const y = (lm[9].y - 0.5) * 2;
            onGesture(true, x, y);
         } else {
            setIsActive(false);
            onGesture(false, 0, 0);
         }
      }
      animationId = requestAnimationFrame(predictWebcam);
    };

    setup();

    return () => {
      cancelAnimationFrame(animationId);
      if(videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(t => t.stop());
      }
    };
  }, []); // Empty dependency array to run once on mount

  return (
    <div 
      className={`absolute bottom-4 right-4 w-[160px] h-[120px] rounded-lg overflow-hidden border border-[#d4af37]/50 shadow-xl z-20 bg-black transition-all duration-500 ease-in-out transform ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
    >
        <canvas ref={canvasRef} width={320} height={240} className="w-full h-full object-cover block" />
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full transition-colors duration-200 ${isActive ? 'bg-green-500 shadow-[0_0_6px_#00ff00]' : 'bg-red-900 shadow-[0_0_4px_#ff0000]'}`} />
    </div>
  );
};

export default Webcam;