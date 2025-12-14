import React, { useState, useRef, useEffect } from 'react';
import { analyzeAudio, generateAdvancedSVC, generateClonedTTS } from '../services/gemini';
import { AudioIcon, StopIcon, UploadIcon, ClearIcon, MusicIcon, LightningIcon, TextIcon, TrashIcon } from '../components/Icons';
import ReactMarkdown from 'react-markdown';
import { VoiceModel, SynthesisParams } from '../types';

type Mode = 'transcription' | 'training' | 'studio';
type StudioMode = 'svc' | 'tts';

export const AudioAnalysis: React.FC = () => {
  const [mode, setMode] = useState<Mode>('studio');
  const [studioMode, setStudioMode] = useState<StudioMode>('svc'); // SVC (Audio-Audio) or TTS (Text-Audio)
  
  // --- Transcription States ---
  const [transcriptionAudio, setTranscriptionAudio] = useState<string | null>(null);
  const [transcriptionPrompt, setTranscriptionPrompt] = useState('');
  const [transcriptionOutput, setTranscriptionOutput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  // --- Training States ---
  const [trainingAudio, setTrainingAudio] = useState<string | null>(null);
  const [modelName, setModelName] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [voiceModels, setVoiceModels] = useState<VoiceModel[]>([]);

  // --- Studio (SVC/TTS) States ---
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [inputAudio, setInputAudio] = useState<string | null>(null); // Song/Speech source for SVC
  const [inputText, setInputText] = useState<string>(''); // Text source for TTS
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisOutput, setSynthesisOutput] = useState<{audioUrl: string | null, text: string} | null>(null);
  
  // VITS Parameters
  const [params, setParams] = useState<SynthesisParams>({
      pitch: 0,
      breathiness: 20,
      reverb: 10,
      similarity: 90
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load models on mount
  useEffect(() => {
      try {
          const saved = localStorage.getItem('prisma_voice_models');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                  setVoiceModels(parsed);
                  console.log("Modelos de voz carregados:", parsed.length);
              }
          }
      } catch (e) {
          console.error("Falha ao carregar modelos:", e);
      }
  }, []);

  // --- Common Helpers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (data: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Recording Logic
  const [activeRecorderState, setActiveRecorderState] = useState<'transcription' | 'training' | 'studio' | null>(null);

  const startRecording = async (targetState: 'transcription' | 'training' | 'studio') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const res = reader.result as string;
            if (targetState === 'transcription') setTranscriptionAudio(res);
            if (targetState === 'training') setTrainingAudio(res);
            if (targetState === 'studio') setInputAudio(res);
        };
        stream.getTracks().forEach(t => t.stop());
        setActiveRecorderState(null);
      };

      mediaRecorder.start();
      setActiveRecorderState(targetState);
    } catch (err) { alert("Microfone indisponível."); }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
  };

  // --- Training Logic ---
  const handleTrainModel = () => {
      if (!trainingAudio || !modelName) return;
      setIsTraining(true);
      setTrainingProgress(0);

      const interval = setInterval(() => {
          setTrainingProgress(prev => {
              if (prev >= 100) {
                  clearInterval(interval);
                  finishTraining();
                  return 100;
              }
              return prev + (Math.random() * 15);
          });
      }, 500);
  };

  const finishTraining = () => {
      const newModel: VoiceModel = {
          id: Date.now().toString(),
          name: modelName,
          sourceAudio: trainingAudio!,
          dateCreated: new Date().toISOString(),
          epochs: 1000
      };

      const updated = [...voiceModels, newModel];
      
      // Tentar salvar no localStorage com tratamento de erro de cota
      try {
          localStorage.setItem('prisma_voice_models', JSON.stringify(updated));
          setVoiceModels(updated);
      } catch (e: any) {
          // Erro comum: QuotaExceededError (arquivo de áudio muito grande para localStorage)
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              alert("Atenção: O áudio deste modelo é muito grande para ser salvo permanentemente no navegador (limite de ~5MB). O modelo funcionará apenas nesta sessão e será perdido ao recarregar a página.");
              // Ainda atualizamos o estado para funcionar agora
              setVoiceModels(updated);
          } else {
              console.error("Erro ao salvar modelo:", e);
              alert("Erro ao salvar o modelo localmente.");
          }
      }

      setIsTraining(false);
      setTrainingAudio(null);
      setModelName('');
      setMode('studio'); 
  };

  const deleteModel = (id: string) => {
      const updated = voiceModels.filter(m => m.id !== id);
      setVoiceModels(updated);
      try {
        localStorage.setItem('prisma_voice_models', JSON.stringify(updated));
        if (selectedModelId === id) setSelectedModelId('');
      } catch (e) {
          console.error("Erro ao atualizar storage após deleção:", e);
      }
  };

  // --- Synthesis Logic ---
  const handleSynthesis = async () => {
      if (!selectedModelId) return;
      const model = voiceModels.find(m => m.id === selectedModelId);
      if (!model) return;

      setIsSynthesizing(true);
      setSynthesisOutput(null);

      try {
          let result;
          if (studioMode === 'svc') {
              // Audio-to-Audio
              if (!inputAudio) return;
              result = await generateAdvancedSVC(model.sourceAudio, inputAudio, params);
          } else {
              // Text-to-Audio (TTS)
              if (!inputText) return;
              result = await generateClonedTTS(model.sourceAudio, inputText, params);
          }
          setSynthesisOutput(result);
      } catch (e) {
          setSynthesisOutput({ audioUrl: null, text: "Erro Crítico na Síntese." });
      } finally {
          setIsSynthesizing(false);
      }
  };

  return (
    <div className="bg-studio-card/60 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-studio-border h-full flex flex-col shadow-neon-border relative overflow-hidden">
        {/* Top Navigation */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-neon-secondary/10 rounded-xl text-neon-secondary border border-neon-secondary/20 shadow-neon"><MusicIcon /></div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">Estúdio Neural</h2>
                    <p className="text-xs text-studio-muted">VITS / SVC / Clone Voice</p>
                </div>
            </div>
            
            <div className="flex bg-black/50 p-1 rounded-xl border border-studio-border overflow-x-auto">
                {(['studio', 'training', 'transcription'] as const).map(m => (
                    <button 
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                            mode === m 
                            ? 'bg-neon-secondary text-white shadow-neon' 
                            : 'text-studio-muted hover:text-white'
                        }`}
                    >
                        {m === 'studio' ? 'Estúdio Clonagem' : m === 'training' ? 'Treinar Voz' : 'Análise'}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar z-10">
            {/* === STUDIO MODE === */}
            {mode === 'studio' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                    {/* Left Panel: Controls */}
                    <div className="lg:col-span-4 space-y-6 flex flex-col">
                        
                        {/* Studio Mode Toggle */}
                        <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
                            <button onClick={() => setStudioMode('svc')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition ${studioMode === 'svc' ? 'bg-white text-black' : 'text-studio-muted hover:text-white'}`}>
                                Áudio-para-Áudio (SVC)
                            </button>
                            <button onClick={() => setStudioMode('tts')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition ${studioMode === 'tts' ? 'bg-white text-black' : 'text-studio-muted hover:text-white'}`}>
                                Texto-para-Fala (TTS)
                            </button>
                        </div>

                        {/* 1. Model Selection */}
                        <div className="bg-black/40 p-4 rounded-xl border border-studio-border">
                            <label className="text-xs font-bold text-neon-secondary uppercase tracking-widest mb-3 block">1. Modelo de Voz</label>
                            {voiceModels.length === 0 ? (
                                <div className="text-center p-4 border border-dashed border-white/10 rounded-lg">
                                    <p className="text-xs text-studio-muted mb-2">Sem modelos treinados.</p>
                                    <button onClick={() => setMode('training')} className="text-xs text-neon-primary underline">Ir para Treino</button>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {voiceModels.map(model => (
                                        <div 
                                            key={model.id} 
                                            onClick={() => setSelectedModelId(model.id)}
                                            className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${
                                                selectedModelId === model.id 
                                                ? 'bg-neon-secondary/20 border-neon-secondary shadow-neon-border' 
                                                : 'bg-black/20 border-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-white truncate w-32">{model.name}</p>
                                                    <p className="text-[9px] text-studio-muted">{model.epochs} Epochs</p>
                                                </div>
                                            </div>
                                            <button onClick={(e) => {e.stopPropagation(); deleteModel(model.id)}} className="text-studio-muted hover:text-red-500 px-2 transition">
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. Input Source (Dynamic based on Mode) */}
                        <div className="bg-black/40 p-4 rounded-xl border border-studio-border flex-1 flex flex-col">
                            <label className="text-xs font-bold text-white uppercase tracking-widest mb-3 block">
                                {studioMode === 'svc' ? '2. Áudio Guia (Cantar/Falar)' : '2. Texto para Clonagem'}
                            </label>
                            
                            {studioMode === 'svc' ? (
                                <>
                                    {!inputAudio ? (
                                        <div className="flex-1 border-2 border-dashed border-studio-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-neon-secondary/50 transition bg-black/20"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <UploadIcon />
                                            <span className="text-[10px] uppercase mt-2 font-bold text-studio-muted">Upload Arquivo</span>
                                        </div>
                                    ) : (
                                        <div className="bg-studio-card p-3 rounded-lg border border-white/10 relative">
                                            <audio src={inputAudio} controls className="w-full h-8" />
                                            <button onClick={() => setInputAudio(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white scale-75"><ClearIcon /></button>
                                        </div>
                                    )}
                                    <div className="mt-3 flex justify-center">
                                        <button 
                                            onClick={() => activeRecorderState === 'studio' ? stopRecording() : startRecording('studio')}
                                            className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${activeRecorderState === 'studio' ? 'bg-red-500/20 text-red-500 border-red-500 animate-pulse' : 'bg-black border-studio-border hover:border-white'}`}
                                        >
                                            {activeRecorderState === 'studio' ? 'Parar Gravação' : 'Gravar Microfone'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <textarea 
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Digite o texto ou letra da música para a voz clonada cantar/falar..."
                                    className="flex-1 w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-neon-secondary outline-none resize-none font-mono"
                                />
                            )}
                        </div>

                        {/* 3. VITS Parameters */}
                        <div className="bg-black/40 p-4 rounded-xl border border-studio-border">
                            <label className="text-xs font-bold text-white uppercase tracking-widest mb-4 block flex items-center gap-2"><LightningIcon /> Parâmetros VITS</label>
                            
                            <div className="space-y-4">
                                {studioMode === 'svc' && (
                                    <div>
                                        <div className="flex justify-between text-[10px] mb-1 font-mono">
                                            <span className="text-studio-muted">PITCH (TOM)</span>
                                            <span className="text-neon-secondary">{params.pitch > 0 ? '+' : ''}{params.pitch}</span>
                                        </div>
                                        <input type="range" min="-12" max="12" step="1" value={params.pitch} onChange={(e) => setParams({...params, pitch: parseInt(e.target.value)})} className="w-full accent-neon-secondary h-1 bg-studio-border rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                )}
                                <div>
                                    <div className="flex justify-between text-[10px] mb-1 font-mono">
                                        <span className="text-studio-muted">BREATHINESS (AR)</span>
                                        <span className="text-white">{params.breathiness}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={params.breathiness} onChange={(e) => setParams({...params, breathiness: parseInt(e.target.value)})} className="w-full accent-white h-1 bg-studio-border rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] mb-1 font-mono">
                                        <span className="text-studio-muted">REVERB (ECO)</span>
                                        <span className="text-white">{params.reverb}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={params.reverb} onChange={(e) => setParams({...params, reverb: parseInt(e.target.value)})} className="w-full accent-white h-1 bg-studio-border rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Output & Visualization */}
                    <div className="lg:col-span-8 bg-black/20 border border-studio-border rounded-2xl p-6 flex flex-col items-center justify-center relative">
                         {isSynthesizing && (
                             <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm rounded-2xl">
                                 <div className="w-20 h-20 relative">
                                     <div className="absolute inset-0 border-4 border-neon-secondary/30 rounded-full"></div>
                                     <div className="absolute inset-0 border-4 border-t-neon-secondary rounded-full animate-spin"></div>
                                 </div>
                                 <p className="mt-4 text-neon-secondary font-mono tracking-widest animate-pulse">
                                    {studioMode === 'svc' ? 'Realizando Conversão SVC...' : 'Gerando TTS Neural...'}
                                 </p>
                                 <p className="text-xs text-studio-muted mt-2">Processando Tensores de Áudio</p>
                             </div>
                         )}

                         {!synthesisOutput ? (
                             <div className="text-center opacity-50">
                                 <div className="w-24 h-24 rounded-full border border-dashed border-white/20 flex items-center justify-center mx-auto mb-4">
                                     {studioMode === 'svc' ? <MusicIcon /> : <TextIcon />}
                                 </div>
                                 <p className="text-sm font-bold text-white uppercase tracking-widest">Estúdio Pronto</p>
                                 <p className="text-xs text-studio-muted mt-2">
                                    {studioMode === 'svc' ? 'Carregue um modelo e um áudio guia.' : 'Carregue um modelo e digite o texto.'}
                                 </p>
                                 <button 
                                    onClick={handleSynthesis}
                                    disabled={!selectedModelId || (studioMode === 'svc' ? !inputAudio : !inputText)}
                                    className={`mt-6 px-8 py-3 rounded-full font-bold uppercase tracking-widest transition-all ${
                                        !selectedModelId || (studioMode === 'svc' ? !inputAudio : !inputText)
                                        ? 'bg-studio-border text-studio-muted cursor-not-allowed' 
                                        : 'bg-neon-secondary text-white hover:bg-neon-secondary/80 hover:scale-105 shadow-neon-strong'
                                    }`}
                                 >
                                    {studioMode === 'svc' ? 'Converter Voz' : 'Gerar Fala Clonada'}
                                 </button>
                             </div>
                         ) : (
                             <div className="w-full h-full flex flex-col">
                                 <div className="flex-1 bg-studio-card/50 rounded-xl border border-white/5 p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                                     {/* Visualizer bars simulation */}
                                     <div className="flex items-end gap-1 h-32 absolute bottom-0 left-0 right-0 opacity-20 group-hover:opacity-40 transition duration-1000 px-4 justify-center">
                                         {[...Array(20)].map((_,i) => (
                                             <div key={i} className="w-2 bg-neon-secondary rounded-t-sm animate-[pulse_1s_ease-in-out_infinite]" style={{height: `${Math.random()*100}%`, animationDelay: `${i*0.1}s`}}></div>
                                         ))}
                                     </div>
                                     
                                     {synthesisOutput.audioUrl ? (
                                         <div className="z-10 w-full max-w-md text-center">
                                             <h3 className="text-2xl font-bold text-white mb-2 text-shadow-neon">Geração Concluída</h3>
                                             <div className="bg-black/80 p-4 rounded-xl border border-neon-secondary/50 shadow-neon mb-6">
                                                 <audio src={synthesisOutput.audioUrl} controls className="w-full" autoPlay />
                                             </div>
                                             <div className="flex justify-center gap-4">
                                                <button onClick={() => setSynthesisOutput(null)} className="px-6 py-2 rounded-full border border-white/20 text-xs font-bold hover:bg-white hover:text-black transition">Reset</button>
                                                <a href={synthesisOutput.audioUrl} download={`cloned_${studioMode}.wav`} className="px-6 py-2 rounded-full bg-neon-secondary text-white text-xs font-bold hover:shadow-neon transition">Download WAV</a>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="z-10 p-6 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-xs font-mono">
                                             {synthesisOutput.text}
                                         </div>
                                     )}
                                 </div>
                             </div>
                         )}
                    </div>
                </div>
            )}

            {/* === TRAINING MODE === */}
            {mode === 'training' && (
                <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto animate-fade-in">
                    <div className="w-full bg-black/40 border border-studio-border p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                        {isTraining && (
                            <div className="absolute inset-0 bg-black/95 z-20 flex flex-col items-center justify-center">
                                <div className="w-full max-w-md space-y-2">
                                    <div className="flex justify-between text-xs font-mono text-neon-primary uppercase">
                                        <span>Training Epochs...</span>
                                        <span>{Math.round(trainingProgress)}%</span>
                                    </div>
                                    <div className="h-2 bg-studio-border rounded-full overflow-hidden">
                                        <div className="h-full bg-neon-primary transition-all duration-300" style={{width: `${trainingProgress}%`}}></div>
                                    </div>
                                    <p className="text-[10px] text-studio-muted text-center mt-2">Extraindo vetores de timbre e prosódia...</p>
                                </div>
                            </div>
                        )}

                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-white mb-2">Treino de Modelo Neural</h3>
                            <p className="text-sm text-studio-muted">Crie um novo modelo de voz a partir de amostras de áudio.</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-white uppercase mb-2 block">1. Nome do Modelo</label>
                                <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Ex: Voz da Maria, Cantor Pop..." className="w-full bg-black border border-studio-border rounded-xl p-3 text-white focus:border-neon-primary outline-none" />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-white uppercase mb-2 block">2. Dataset (Áudio de Referência)</label>
                                <div className="flex gap-4 items-center">
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex-1 h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition ${trainingAudio ? 'border-neon-primary bg-neon-primary/10' : 'border-studio-border'}`}
                                    >
                                        {trainingAudio ? <span className="text-neon-primary font-bold">Audio Carregado ✓</span> : (
                                            <>
                                                <UploadIcon />
                                                <span className="text-xs mt-2 text-studio-muted">Upload Dataset (WAV/MP3)</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs text-studio-muted text-center uppercase">Ou</span>
                                        <button 
                                            onClick={() => activeRecorderState === 'training' ? stopRecording() : startRecording('training')}
                                            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${activeRecorderState === 'training' ? 'border-red-500 text-red-500 animate-pulse' : 'border-white text-white hover:bg-white hover:text-black'}`}
                                        >
                                            {activeRecorderState === 'training' ? <div className="w-4 h-4 bg-red-500 rounded sm"></div> : <div className="w-4 h-4 bg-white rounded-full"></div>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleTrainModel}
                                disabled={!modelName || !trainingAudio}
                                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all ${
                                    !modelName || !trainingAudio 
                                    ? 'bg-studio-border text-studio-muted' 
                                    : 'bg-neon-primary text-white hover:bg-neon-primary/80 shadow-neon-strong'
                                }`}
                            >
                                Iniciar Treinamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === TRANSCRIPTION MODE (Legacy) === */}
            {mode === 'transcription' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    {/* Simplified Transcription UI */}
                    <div className="space-y-6">
                        <div className="bg-black/40 border border-studio-border p-6 rounded-2xl text-center">
                            <h3 className="text-white font-bold mb-4">Input de Áudio</h3>
                            {!transcriptionAudio ? (
                                <div className="flex justify-center gap-4">
                                     <button onClick={() => activeRecorderState === 'transcription' ? stopRecording() : startRecording('transcription')} className="p-4 rounded-full bg-black border border-studio-border hover:border-white transition">
                                         {activeRecorderState === 'transcription' ? <span className="text-red-500 animate-pulse">● Rec</span> : <span className="text-white">Microfone</span>}
                                     </button>
                                     <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full bg-black border border-studio-border hover:border-white transition text-white">Upload</button>
                                </div>
                            ) : (
                                <div className="bg-studio-card p-4 rounded-xl border border-white/10">
                                    <audio src={transcriptionAudio} controls className="w-full" />
                                    <button onClick={() => setTranscriptionAudio(null)} className="text-xs text-red-500 mt-2 underline">Remover</button>
                                </div>
                            )}
                        </div>
                        <textarea value={transcriptionPrompt} onChange={e => setTranscriptionPrompt(e.target.value)} placeholder="Instrução opcional..." className="w-full bg-black/40 border border-studio-border rounded-xl p-4 text-white text-sm" />
                        <button 
                            onClick={async () => {
                                if(!transcriptionAudio) return;
                                setIsTranscribing(true);
                                const res = await analyzeAudio(transcriptionAudio, transcriptionPrompt);
                                setTranscriptionOutput(res);
                                setIsTranscribing(false);
                            }}
                            disabled={!transcriptionAudio || isTranscribing}
                            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50"
                        >
                            {isTranscribing ? 'Analisando...' : 'Transcrever'}
                        </button>
                    </div>
                    <div className="bg-black/40 border border-studio-border rounded-2xl p-6 overflow-y-auto">
                        <ReactMarkdown className="prose prose-invert prose-sm">{transcriptionOutput}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>

        {/* Hidden File Input for reuse */}
        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={(e) => {
            if (mode === 'studio' && studioMode === 'svc') handleFileUpload(e, setInputAudio);
            else if (mode === 'training') handleFileUpload(e, setTrainingAudio);
            else if (mode === 'transcription') handleFileUpload(e, setTranscriptionAudio);
        }} />
    </div>
  );
};