import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startCamera = useCallback(async () => {
    setIsStarting(true);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    } finally {
      setIsStarting(false);
    }
  }, [facingMode]);

  React.useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(base64Image);
        onClose();
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Camera
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera View */}
        <div className="relative aspect-[4/3] bg-black flex items-center justify-center">
          {isStarting ? (
            <div className="text-zinc-500 animate-pulse">Starting camera...</div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="p-6 flex items-center justify-center gap-6">
          <button
            onClick={toggleCamera}
            className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
            title="Switch Camera"
          >
            <RefreshCw className="w-6 h-6" />
          </button>
          
          <button
            onClick={capturePhoto}
            disabled={isStarting}
            className="w-16 h-16 rounded-full border-4 border-zinc-400 flex items-center justify-center hover:border-white transition-colors disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-white rounded-full"></div>
          </button>
          
          <div className="w-12"></div> {/* Spacer for balance */}
        </div>
      </div>
    </div>
  );
}
