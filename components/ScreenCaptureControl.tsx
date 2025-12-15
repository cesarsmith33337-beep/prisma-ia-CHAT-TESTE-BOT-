import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ScreenCaptureHandle } from '../types';
import { LightningIcon, StopIcon, EyeIcon } from './Icons';

interface ScreenCaptureControlProps {
  onCaptureFrame: (dataUrl: string) => void;
  isAnalyzing: boolean;
  timeframe: '1M' | '5M' | '15M';
  onTimeframeChange: (t: '1M' | '5M' | '15M') => void;
  isPaused: boolean;
  onError?: (message: string) => void;
  captureRef?: React.MutableRefObject<ScreenCaptureHandle | null>;
}

export const ScreenCaptureControl: React.FC<ScreenCaptureControlProps> = ({ 
  onCaptureFrame, 
  isAnalyzing, 
  timeframe, 
  onTimeframeChange,
  isPaused,
  onError,
  captureRef
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>("00:00");
  const [syncActive, setSyncActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  const startCapture = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Seu navegador ou dispositivo não suporta captura de tela. Tente usar Chrome/Edge no Desktop.");
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          // @ts-ignore
          cursor: 'always' 
        },
        audio: false
      });
      setStream(displayStream);
      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }
    } catch (err: any) {
      console.error("Erro ao compartilhar tela", err);
      let message = err.message || "Falha ao iniciar captura de tela.";
      if (err.name === 'NotAllowedError') {
        message = "Permissão negada. Por favor, permita o compartilhamento de tela.";
      } else if (err.message?.includes("display-capture")) {
        message = "A política de permissões bloqueou a captura. Tente recarregar ou usar outro navegador.";
      }
      if (onError) onError(message);
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setSyncActive(false);
    }
  };

  const captureNow = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      const video = videoRef.current;
      
      if (context && video.videoWidth > 0) {
        // OPTIMIZATION: Downscale image to max 1280px width
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;

        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        context.drawImage(video, 0, 0, width, height);
        
        // OPTIMIZATION: Use JPEG quality 0.6
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
        return dataUrl;
      }
    }
    return null;
  }, []);

  // Expose capture method to parent via ref
  useEffect(() => {
    if (captureRef) {
      captureRef.current = {
        captureFrame: () => {
          const data = captureNow();
          return data;
        }
      };
    }
  }, [captureRef, captureNow]);

  const handleManualCapture = () => {
    const data = captureNow();
    if (data) onCaptureFrame(data);
  };

  // SMART SYNC LOGIC (T-10 Seconds Strategy)
  useEffect(() => {
    if (!syncActive || !stream || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdownStr("PARADO");
      return;
    }

    const getNextTriggerTime = () => {
      const now = new Date();
      const ms = now.getMilliseconds();
      const s = now.getSeconds();
      const m = now.getMinutes();

      let timeToNextTop = 0;
      let intervalMs = 0;

      if (timeframe === '1M') {
        timeToNextTop = (60 - s) * 1000 - ms;
        intervalMs = 60000;
      } else if (timeframe === '5M') {
        const remainder = m % 5;
        const minutesToNext = 5 - remainder;
        timeToNextTop = (minutesToNext * 60 - s) * 1000 - ms;
        intervalMs = 300000;
      } else if (timeframe === '15M') {
        const remainder = m % 15;
        const minutesToNext = 15 - remainder;
        timeToNextTop = (minutesToNext * 60 - s) * 1000 - ms;
        intervalMs = 900000;
      }
      
      const PRE_ANALYSIS_BUFFER = 10000; 
      let triggerDelay = timeToNextTop - PRE_ANALYSIS_BUFFER;

      if (triggerDelay < 0) {
        triggerDelay += intervalMs;
      }

      return triggerDelay;
    };

    const countdownInterval = setInterval(() => {
      const delay = getNextTriggerTime();
      const totalSeconds = Math.floor(delay / 1000);
      const min = Math.floor(totalSeconds / 60);
      const sec = totalSeconds % 60;
      
      setCountdownStr(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`);
      
      if (delay <= 1000 && delay > 0) {
        setTimeout(() => {
          console.log(`🚀 T-10s DISPARO: Analisando ${timeframe}`);
          const data = captureNow();
          if (data) onCaptureFrame(data);
        }, delay);
      }
    }, 1000);

    timerRef.current = countdownInterval as unknown as number;

    return () => {
      clearInterval(countdownInterval);
    };
  }, [syncActive, stream, timeframe, isPaused, captureNow, onCaptureFrame]);

  return (
    <div className="bg-[#18181b]/90 backdrop-blur-xl p-6 rounded-3xl mb-6 border border-white/10 shadow-2xl animate-fade-in">
      <div className="flex flex-col md:flex-row gap-6 items-center">
        {/* Video Preview */}
        <div className="relative w-full md:w-1/2 aspect-video bg-black/50 rounded-2xl overflow-hidden border border-white/10 shadow-inner group ring-1 ring-white/5">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center text-white/30 flex-col gap-2">
              <EyeIcon />
              <span className="font-mono text-sm tracking-widest">VISÃO DESCONECTADA</span>
            </div>
          )}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10 transition-opacity">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-neon-primary border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.5)]"></div>
                <span className="text-neon-primary font-bold animate-pulse tracking-widest text-sm font-mono">PROCESSANDO SINAL...</span>
              </div>
            </div>
          )}
          {isPaused && (
             <div className="absolute inset-0 bg-neon-primary/20 flex items-center justify-center backdrop-blur-sm z-10 border-2 border-neon-primary/50">
               <span className="text-neon-primary font-black text-xl tracking-widest bg-black/80 px-4 py-2 rounded">STOP LOSS / PAUSADO</span>
             </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          <div className="flex items-center justify-between text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1 px-1">
            <span>Timeframe Operacional</span>
            <span className="text-neon-primary">{timeframe}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/5">
            {(['1M', '5M', '15M'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  onTimeframeChange(t);
                  if(syncActive) {
                    setSyncActive(false);
                    setTimeout(() => setSyncActive(true), 100);
                  }
                }}
                className={`py-2 rounded-xl font-bold text-xs transition-all font-mono ${
                  timeframe === t 
                    ? 'bg-neon-primary text-white shadow-neon' 
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {!stream ? (
            <button 
              onClick={startCapture}
              className="w-full py-6 bg-black/40 hover:bg-white/5 border border-white/10 hover:border-neon-primary/50 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-3 group mt-2"
            >
               <div className="p-2.5 rounded-full bg-neon-primary/10 group-hover:bg-neon-primary/30 text-neon-primary transition-colors shadow-neon-sm">
                 <EyeIcon />
               </div>
               <div className="text-left">
                  <span className="block text-xs text-white/40 font-normal uppercase">Setup Inicial</span>
                  <span className="text-lg tracking-wide font-display font-bold">CONECTAR CORRETORA</span>
               </div>
            </button>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              <button 
                onClick={handleManualCapture}
                disabled={isAnalyzing || isPaused}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-bold text-white/80 shadow transition-all disabled:opacity-50 text-xs uppercase tracking-wide flex items-center justify-center gap-2 hover:border-neon-primary/50 hover:text-white hover:shadow-neon-sm"
              >
                <EyeIcon />
                ANÁLISE PRISMA IA
              </button>
              
              <button
                onClick={() => setSyncActive(!syncActive)}
                className={`w-full py-4 border rounded-2xl font-bold transition-all flex items-center justify-center gap-2 relative overflow-hidden group ${
                  syncActive 
                    ? 'border-neon-primary text-white bg-neon-primary/20 shadow-neon' 
                    : 'border-white/10 text-white bg-black/40 hover:bg-white/5'
                }`}
              >
                 {syncActive && (
                   <div className="absolute inset-0 bg-neon-primary/5 animate-pulse"></div>
                 )}
                 
                 {syncActive ? (
                   <div className="flex flex-col items-center z-10">
                     <div className="flex items-center gap-2 text-neon-primary mb-0.5">
                       <span className="w-2 h-2 bg-neon-primary rounded-full animate-pulse shadow-[0_0_8px_currentColor]"></span>
                       <span className="text-[10px] font-black tracking-widest uppercase">TEMPO GRÁFICO</span>
                     </div>
                     <span className="text-3xl font-display font-black tracking-widest text-white drop-shadow-md">{countdownStr}</span>
                   </div>
                 ) : (
                   <div className="flex items-center gap-3 z-10">
                     <LightningIcon />
                     <span className="tracking-wide text-sm">INICIAR ROBÔ (AUTO)</span>
                   </div>
                 )}
              </button>

              <button 
                onClick={stopCapture}
                className="group w-full mt-2 py-3 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <StopIcon />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Desconectar Feed</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};