import React, { useState, useRef, useEffect } from 'react';
import { analyzeAudio, generateAdvancedSVC, generateClonedTTS, generateSongComposition, generateAICover, generateMusicAudio } from '../services/gemini';
import { AudioIcon, StopIcon, UploadIcon, ClearIcon, MusicIcon, LightningIcon, TextIcon, TrashIcon, SparklesIcon, SaveIcon, MicIcon, CheckIcon, FileIcon } from '../components/Icons';
import ReactMarkdown from 'react-markdown';
import { VoiceModel, SynthesisParams, SongComposition } from '../types';

type Mode = 'suno_gen' | 'ai_cover' | 'rvc_studio' | 'training' | 'transcription';
type StudioMode = 'svc' | 'tts';

export const AudioAnalysis: React.FC = () => {
  const [mode, setMode] = useState<Mode>('suno_gen');
  const [studioMode, setStudioMode] = useState<StudioMode>('svc'); 
  
  // --- Suno / Music Gen States ---
  const [songPrompt, setSongPrompt] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [generatedSong, setGeneratedSong] = useState<SongComposition | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [generatedSongAudio, setGeneratedSongAudio] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // --- AI Cover States ---
  const [coverSong, setCoverSong] = useState<string | null>(null);
  const [coverVoice, setCoverVoice] = useState<string | null>(null);
  const [isCovering, setIsCovering] = useState(false);
  const [coverOutput, setCoverOutput] = useState<{audioUrl: string | null, text: string} | null>(null);
  const [coverProgressText, setCoverProgressText] = useState('');

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
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]); // Logs de terminal
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const TOTAL_EPOCHS = 100;

  // --- RVC Studio States ---
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [inputAudio, setInputAudio] = useState<string | null>(null); 
  const [inputText, setInputText] = useState<string>(''); 
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisOutput, setSynthesisOutput] = useState<{audioUrl: string | null, text: string} | null>(null);
  const [vocalStyle, setVocalStyle] = useState<string>('speech'); 
  
  const [params, setParams] = useState<SynthesisParams>({
      pitch: 0,
      breathiness: 20,
      reverb: 10,
      similarity: 90,
      speed: 1.0
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trainingLogsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      try {
          const saved = localStorage.getItem('prisma_voice_models');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) setVoiceModels(parsed);
          }
      } catch (e) { console.error(e); }
  }, []);

  // Validation Logic
  const getDisabledReason = () => {
      if (!selectedModelId) return "Selecione um Modelo de Voz";
      const modelExists = voiceModels.find(m => m.id === selectedModelId);
      if (!modelExists) return "Modelo não encontrado (Apagado?)";
      
      if (studioMode === 'svc') {
          if (!inputAudio) return "Carregue ou grave um Áudio de Input";
      } else {
          if (!inputText.trim()) return "Digite um texto para falar/cantar";
      }
      return null;
  };

  const disabledReason = getDisabledReason();
  const isButtonDisabled = !!disabledReason;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (data: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const [activeRecorderState, setActiveRecorderState] = useState<'transcription' | 'training' | 'studio' | 'cover' | null>(null);

  const startRecording = async (targetState: 'transcription' | 'training' | 'studio' | 'cover') => {
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
            if (targetState === 'cover') setCoverVoice(res);
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

  const addLog = (msg: string) => {
      setTrainingLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      setTimeout(() => trainingLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleTrainModel = () => {
      if (!trainingAudio || !modelName) return;
      setIsTraining(true);
      setTrainingProgress(0);
      setTrainingLogs([]);
      setCurrentEpoch(0);

      addLog("Inicializando ambiente de treino...");
      
      // Simulação detalhada do processo RVC
      let stage = 0;
      let progress = 0;
      let epoch = 0;

      const interval = setInterval(() => {
          progress += Math.random() * 2;
          
          // Stages Logic
          if (progress > 5 && stage === 0) {
              stage = 1;
              addLog("Validando dataset de áudio...");
          }
          if (progress > 15 && stage === 1) {
              stage = 2;
              addLog("Dataset verificado: Frequência de amostragem 40k/48k detectada.");
              addLog("Extraindo Pitch (f0) usando método 'rmvpe'...");
          }
          if (progress > 25 && stage === 2) {
              stage = 3;
              addLog("Extração de características concluída.");
              addLog("Iniciando loop de treinamento...");
          }
          
          if (progress > 30) {
              const estimatedEpoch = Math.floor(((progress - 30) / 60) * TOTAL_EPOCHS);
              if (estimatedEpoch > epoch && estimatedEpoch <= TOTAL_EPOCHS) {
                  epoch = estimatedEpoch;
                  setCurrentEpoch(epoch);
                  if (epoch % 10 === 0) addLog(`Epoch ${epoch}/${TOTAL_EPOCHS} finalizada. Loss: ${(Math.random() * 0.5).toFixed(4)}`);
              }
          }

          if (progress >= 95 && stage === 3) {
              stage = 4;
              addLog("Treinamento concluído. Salvando pesos do modelo (.pth)...");
              addLog("Gerando arquivo de índice de feature (added_IVF1024_Flat_nprobe_1)...");
          }

          if (progress >= 100) {
              clearInterval(interval);
              addLog("Modelo exportado com sucesso!");
              finishTraining();
              return 100;
          }
          setTrainingProgress(Math.min(progress, 100));
      }, 200);
  };

  const finishTraining = () => {
      const newModel: VoiceModel = {
          id: Date.now().toString(),
          name: modelName,
          sourceAudio: trainingAudio!,
          dateCreated: new Date().toISOString(),
          epochs: TOTAL_EPOCHS
      };
      
      const updated = [...voiceModels, newModel];
      
      // Persistence with Quota Check
      try {
          localStorage.setItem('prisma_voice_models', JSON.stringify(updated));
          setVoiceModels(updated);
          setTimeout(() => {
              setIsTraining(false); 
              setTrainingAudio(null); 
              setModelName(''); 
              setMode('rvc_studio');
          }, 2000);
      } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.code === 22) {
              alert("⚠️ ARMAZENAMENTO CHEIO: O modelo foi treinado com sucesso, mas não pôde ser salvo permanentemente no navegador devido ao limite de espaço (QuotaExceededError). Ele estará disponível apenas nesta sessão.");
              setVoiceModels(updated); // Mantém em memória para a sessão atual
              setTimeout(() => {
                setIsTraining(false); 
                setMode('rvc_studio');
            }, 2000);
          } else {
              console.error(e);
          }
      }
  };

  const deleteModel = (id: string) => {
      if(!confirm("Tem certeza que deseja apagar este modelo de voz?")) return;
      const updated = voiceModels.filter(m => m.id !== id);
      setVoiceModels(updated);
      try {
        localStorage.setItem('prisma_voice_models', JSON.stringify(updated));
      } catch(e) { console.error("Error updating storage", e); }
      if (selectedModelId === id) setSelectedModelId('');
  };

  const handleSynthesis = async () => {
      if (isButtonDisabled) return;
      
      const model = voiceModels.find(m => m.id === selectedModelId);
      if (!model) return;
      
      setIsSynthesizing(true);
      setSynthesisOutput(null);
      try {
          let result;
          if (studioMode === 'svc') {
              if (!inputAudio) return;
              result = await generateAdvancedSVC(model.sourceAudio, inputAudio, params);
          } else {
              if (!inputText) return;
              result = await generateClonedTTS(model.sourceAudio, inputText, params, vocalStyle);
          }
          setSynthesisOutput(result);
      } catch (e) { setSynthesisOutput({ audioUrl: null, text: "Erro Crítico na Síntese RVC." }); } 
      finally { setIsSynthesizing(false); }
  };

  const handleComposeSong = async () => {
      if(!songPrompt) return;
      setIsComposing(true);
      setGeneratedSong(null);
      setGeneratedSongAudio(null);
      try {
          const song = await generateSongComposition(songPrompt, customLyrics);
          setGeneratedSong(song);
      } catch(e) { console.error(e); }
      finally { setIsComposing(false); }
  }
  
  const handleGenerateSongAudio = async () => {
      if(!generatedSong) return;
      setIsGeneratingAudio(true);
      try {
          const result = await generateMusicAudio(generatedSong);
          if (result.audioUrl) {
              setGeneratedSongAudio(result.audioUrl);
          } else {
              alert(result.text);
          }
      } catch(e) { console.error(e); }
      finally { setIsGeneratingAudio(false); }
  }

  const handleSunoTransfer = () => {
      setMode('rvc_studio');
      setStudioMode('tts');
      setInputText(generatedSong?.lyrics || '');
      setVocalStyle('singing_trap'); 
  }

  const handleCreateCover = async () => {
      if (!coverSong || !coverVoice) return;
      setIsCovering(true);
      setCoverOutput(null);
      setCoverProgressText("Analisando Música Original (Lyrics & Vibe)...");
      
      try {
          const result = await generateAICover(coverSong, coverVoice);
          setCoverOutput(result);
      } catch (e) {
          setCoverOutput({ audioUrl: null, text: "Erro na geração do cover." });
      } finally {
          setIsCovering(false);
          setCoverProgressText("");
      }
  };

  const isTranscriptionZip = transcriptionAudio && (transcriptionAudio.includes('application/zip') || transcriptionAudio.includes('application/x-zip-compressed'));

  return (
    <div className="bg-studio-card/80 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-studio-border h-full flex flex-col shadow-neon-border relative overflow-hidden">
        {/* Top Navigation */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-neon-secondary/10 rounded-xl text-neon-secondary border border-neon-secondary/20 shadow-neon"><MusicIcon /></div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-wide">Estúdio Sonoro</h2>
                    <p className="text-xs text-studio-muted">Suno Gen • RVC Voice • AI Cover</p>
                </div>
            </div>
            
            <div className="flex bg-black/50 p-1 rounded-xl border border-studio-border overflow-x-auto">
                <button onClick={() => setMode('suno_gen')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'suno_gen' ? 'bg-gradient-to-r from-neon-primary to-neon-secondary text-white shadow-neon' : 'text-studio-muted hover:text-white'}`}>Suno Music Gen</button>
                <button onClick={() => setMode('ai_cover')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'ai_cover' ? 'bg-neon-primary text-white shadow-neon' : 'text-studio-muted hover:text-white'}`}>Recriar (AI Cover)</button>
                <button onClick={() => setMode('rvc_studio')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'rvc_studio' ? 'bg-neon-secondary text-white shadow-neon' : 'text-studio-muted hover:text-white'}`}>RVC Studio</button>
                <button onClick={() => setMode('training')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'training' ? 'bg-white/10 text-white' : 'text-studio-muted hover:text-white'}`}>Treinar Voz</button>
                <button onClick={() => setMode('transcription')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'transcription' ? 'bg-white/10 text-white' : 'text-studio-muted hover:text-white'}`}>Transcrever</button>
            </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar z-10">
            
            {/* === SUNO MUSIC GEN MODE === */}
            {mode === 'suno_gen' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    {/* Input */}
                    <div className="space-y-6 flex flex-col">
                        <div className="bg-black/40 p-6 rounded-2xl border border-studio-border flex-1">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><SparklesIcon /> Compositor IA</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-neon-primary uppercase font-bold mb-2 block">1. Descrição da Música (Estilo & Vibe)</label>
                                    <textarea 
                                        value={songPrompt} 
                                        onChange={e => setSongPrompt(e.target.value)} 
                                        placeholder="Ex: Um trap futurista estilo cyberpunk, 140BPM, com graves distorcidos, sobre pilotar naves em neon..." 
                                        className="w-full h-24 bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-neon-primary outline-none resize-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-studio-muted uppercase font-bold mb-2 block">2. Letra Customizada (Opcional)</label>
                                    <textarea 
                                        value={customLyrics} 
                                        onChange={e => setCustomLyrics(e.target.value)} 
                                        placeholder="Se deixar vazio, a IA escreverá a letra..." 
                                        className="w-full h-24 bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-neon-secondary outline-none resize-none font-mono"
                                    />
                                </div>
                                <button 
                                    onClick={handleComposeSong}
                                    disabled={!songPrompt || isComposing}
                                    className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${!songPrompt || isComposing ? 'bg-studio-border text-studio-muted' : 'bg-gradient-to-r from-neon-primary to-neon-secondary text-white shadow-neon hover:scale-[1.02]'}`}
                                >
                                    {isComposing ? 'Compondo Sinfonia...' : '1. Gerar Composição (Texto)'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Output */}
                    <div className="bg-black/20 border border-studio-border rounded-2xl p-6 relative overflow-hidden flex flex-col">
                         {!generatedSong ? (
                             <div className="flex-1 flex flex-col items-center justify-center text-studio-muted opacity-50">
                                 <MusicIcon />
                                 <p className="mt-4 text-sm">O resultado da composição aparecerá aqui.</p>
                             </div>
                         ) : (
                             <div className="flex-1 overflow-y-auto custom-scrollbar animate-fade-in space-y-6">
                                 <div className="border-b border-white/10 pb-4">
                                     <h2 className="text-2xl font-bold text-white text-shadow-neon">{generatedSong.title}</h2>
                                     <p className="text-neon-secondary text-sm font-mono mt-1">{generatedSong.style}</p>
                                     <p className="text-xs text-studio-muted mt-2 italic">{generatedSong.vibeDescription}</p>
                                 </div>
                                 
                                 {/* Audio Generation Section */}
                                 <div className="bg-black/60 p-4 rounded-xl border border-neon-primary/30 shadow-neon">
                                     {generatedSongAudio ? (
                                         <div className="space-y-3">
                                             <div className="flex items-center gap-2 text-neon-primary text-xs font-bold uppercase tracking-widest"><SparklesIcon /> Preview Gerado</div>
                                             <audio src={generatedSongAudio} controls className="w-full h-8" autoPlay />
                                             <a href={generatedSongAudio} download="suno_gen.wav" className="block text-center text-xs text-white/60 hover:text-white underline">Baixar Audio</a>
                                         </div>
                                     ) : (
                                         <button 
                                            onClick={handleGenerateSongAudio}
                                            disabled={isGeneratingAudio}
                                            className="w-full py-3 bg-neon-secondary/20 hover:bg-neon-secondary/40 border border-neon-secondary text-neon-secondary rounded-lg font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                         >
                                             {isGeneratingAudio ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <MusicIcon />}
                                             {isGeneratingAudio ? 'Sintetizando Áudio...' : '2. Gerar Áudio (Suno Style)'}
                                         </button>
                                     )}
                                 </div>

                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="bg-white/5 p-3 rounded-lg">
                                         <span className="text-[10px] text-studio-muted uppercase block">Estrutura</span>
                                         <span className="text-xs text-white font-mono">{generatedSong.structure}</span>
                                     </div>
                                     <div className="bg-white/5 p-3 rounded-lg">
                                         <span className="text-[10px] text-studio-muted uppercase block">Acordes (Chords)</span>
                                         <span className="text-xs text-neon-primary font-mono">{generatedSong.chords}</span>
                                     </div>
                                 </div>

                                 <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-sm leading-relaxed whitespace-pre-wrap text-white/90">
                                     {generatedSong.lyrics}
                                 </div>

                                 <div className="pt-2">
                                     <button 
                                        onClick={handleSunoTransfer}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-transform flex items-center justify-center gap-2 border border-white/10"
                                     >
                                         <MicIcon /> Editar no RVC Studio
                                     </button>
                                 </div>
                             </div>
                         )}
                    </div>
                </div>
            )}

             {/* === AI COVER MODE === */}
             {mode === 'ai_cover' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-fade-in">
                    <div className="space-y-6">
                        <div className="bg-black/40 p-6 rounded-2xl border border-studio-border">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><SparklesIcon /> Recriar Música (AI Cover)</h3>
                            <p className="text-xs text-studio-muted mb-6">Substitua a voz original de uma música pela sua voz gravada, mantendo o ritmo e melodia.</p>
                            
                            <div className="space-y-4">
                                {/* Upload Música */}
                                <div>
                                    <label className="text-[10px] text-neon-secondary uppercase font-bold mb-2 block">1. Música Original (Base)</label>
                                    <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition ${coverSong ? 'border-neon-secondary bg-neon-secondary/10' : 'border-studio-border hover:border-white/20'}`} onClick={() => !coverSong && fileInputRef.current?.click()}>
                                        {coverSong ? (
                                            <div className="w-full flex items-center justify-between">
                                                <div className="flex items-center gap-2"><MusicIcon /><span className="text-xs text-white">Música Carregada</span></div>
                                                <button onClick={(e) => {e.stopPropagation(); setCoverSong(null)}} className="text-red-500"><ClearIcon /></button>
                                            </div>
                                        ) : (
                                            <div className="text-center text-studio-muted"><UploadIcon /><span className="text-xs block mt-1">Carregar MP3/WAV/OGG</span></div>
                                        )}
                                    </div>
                                </div>

                                {/* Gravar Voz */}
                                <div>
                                    <label className="text-[10px] text-neon-primary uppercase font-bold mb-2 block">2. Sua Voz (Referência de Timbre)</label>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => activeRecorderState === 'cover' ? stopRecording() : startRecording('cover')}
                                            className={`flex-1 py-3 rounded-xl border font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition ${activeRecorderState === 'cover' ? 'bg-red-500/20 text-red-500 border-red-500 animate-pulse' : 'bg-black border-studio-border text-white hover:border-white'}`}
                                        >
                                            {activeRecorderState === 'cover' ? <><div className="w-2 h-2 bg-red-500 rounded-full"></div> Parar Gravação</> : <><MicIcon /> Gravar Voz</>}
                                        </button>
                                        {coverVoice && <div className="p-3 bg-neon-primary/20 rounded-xl border border-neon-primary flex items-center text-neon-primary"><CheckIcon /></div>}
                                    </div>
                                    <p className="text-[9px] text-studio-muted mt-2 text-center">Cante ou fale por pelo menos 10 segundos para capturar seu timbre.</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleCreateCover}
                                disabled={!coverSong || !coverVoice || isCovering}
                                className={`w-full py-4 mt-6 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${!coverSong || !coverVoice || isCovering ? 'bg-studio-border text-studio-muted cursor-not-allowed' : 'bg-gradient-to-r from-neon-primary to-neon-secondary text-white shadow-neon hover:scale-[1.02]'}`}
                            >
                                {isCovering ? 'Processando Cover...' : 'Gerar Cover AI'}
                            </button>
                        </div>
                    </div>

                    {/* Output */}
                    <div className="bg-black/20 border border-studio-border rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center">
                         {isCovering && (
                             <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                                 <div className="w-24 h-24 relative mb-6">
                                    <div className="absolute inset-0 border-t-4 border-neon-primary rounded-full animate-spin"></div>
                                    <div className="absolute inset-2 border-t-4 border-neon-secondary rounded-full animate-spin" style={{animationDirection: 'reverse'}}></div>
                                 </div>
                                 <p className="text-neon-primary font-mono text-sm tracking-widest animate-pulse">{coverProgressText}</p>
                             </div>
                         )}

                         {!coverOutput ? (
                             <div className="text-center opacity-40">
                                 <div className="w-20 h-20 bg-studio-card rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10"><SparklesIcon /></div>
                                 <p className="text-sm">O cover gerado aparecerá aqui.</p>
                             </div>
                         ) : (
                             <div className="w-full max-w-md text-center animate-fade-in">
                                 {coverOutput.audioUrl ? (
                                    <>
                                        <h3 className="text-2xl font-bold text-white mb-2 text-shadow-neon">Cover Finalizado</h3>
                                        <p className="text-xs text-studio-muted mb-6">Voz substituída com sucesso.</p>
                                        <div className="bg-black/60 p-6 rounded-2xl border border-neon-secondary/50 shadow-neon mb-6">
                                            <audio src={coverOutput.audioUrl} controls className="w-full" autoPlay />
                                        </div>
                                        <a href={coverOutput.audioUrl} download="ai_cover_result.wav" className="inline-block px-8 py-3 rounded-full bg-neon-secondary text-white text-xs font-bold hover:shadow-neon transition">Baixar Cover (.WAV)</a>
                                    </>
                                 ) : (
                                     <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
                                         {coverOutput.text}
                                     </div>
                                 )}
                             </div>
                         )}
                    </div>
                </div>
             )}

            {/* === RVC STUDIO MODE === */}
            {mode === 'rvc_studio' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                    <div className="lg:col-span-4 space-y-6 flex flex-col">
                        <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
                            <button onClick={() => setStudioMode('svc')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition ${studioMode === 'svc' ? 'bg-white text-black' : 'text-studio-muted hover:text-white'}`}>Áudio-para-Áudio (RVC)</button>
                            <button onClick={() => setStudioMode('tts')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition ${studioMode === 'tts' ? 'bg-white text-black' : 'text-studio-muted hover:text-white'}`}>Texto-para-Fala (TTS)</button>
                        </div>

                        {/* Models */}
                        <div className="bg-black/40 p-4 rounded-xl border border-studio-border">
                            <label className="text-xs font-bold text-neon-secondary uppercase tracking-widest mb-3 block">1. Modelo de Voz (.pth Simulado)</label>
                            {voiceModels.length === 0 ? (
                                <div className="text-center p-4 border border-dashed border-white/10 rounded-lg">
                                    <p className="text-xs text-studio-muted mb-2">Sem modelos RVC.</p>
                                    <button onClick={() => setMode('training')} className="text-xs text-neon-primary underline">Treinar Novo Modelo</button>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {voiceModels.map(model => (
                                        <div key={model.id} onClick={() => setSelectedModelId(model.id)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${selectedModelId === model.id ? 'bg-neon-secondary/20 border-neon-secondary shadow-neon-border' : 'bg-black/20 border-white/5 hover:border-white/20'}`}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-white truncate w-32">{model.name}</p>
                                                    <p className="text-[9px] text-studio-muted">RVC v2 • {model.epochs} Epochs</p>
                                                </div>
                                            </div>
                                            <button onClick={(e) => {e.stopPropagation(); deleteModel(model.id)}} className="text-studio-muted hover:text-red-500 px-2 transition"><TrashIcon /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input Source */}
                        <div className="bg-black/40 p-4 rounded-xl border border-studio-border flex-1 flex flex-col">
                            <label className="text-xs font-bold text-white uppercase tracking-widest mb-3 block">{studioMode === 'svc' ? '2. Áudio Input (Inference)' : '2. Texto Input (Inference)'}</label>
                            
                            {/* Estilo Vocal (Apenas para TTS) */}
                            {studioMode === 'tts' && (
                                <div className="mb-4">
                                    <label className="text-[10px] text-studio-muted font-bold uppercase mb-1 block">Estilo da Performance</label>
                                    <select 
                                        value={vocalStyle} 
                                        onChange={(e) => setVocalStyle(e.target.value)} 
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-neon-secondary"
                                    >
                                        <option value="speech">🗣️ Fala Normal (Speech)</option>
                                        <option value="singing_pop">🎤 Cantar - Pop</option>
                                        <option value="singing_trap">🎹 Cantar - Trap/HipHop</option>
                                        <option value="singing_rock">🎸 Cantar - Rock</option>
                                        <option value="singing_opera">🎼 Cantar - Ópera</option>
                                        <option value="singing_lofi">☕ Cantar - Lo-Fi/Chill</option>
                                    </select>
                                </div>
                            )}

                            {studioMode === 'svc' ? (
                                <>
                                    {!inputAudio ? (
                                        <div className="flex-1 border-2 border-dashed border-studio-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-neon-secondary/50 transition bg-black/20" onClick={() => fileInputRef.current?.click()}>
                                            <UploadIcon />
                                            <span className="text-[10px] uppercase mt-2 font-bold text-studio-muted">Carregar .WAV/.MP3</span>
                                        </div>
                                    ) : (
                                        <div className="bg-studio-card p-3 rounded-lg border border-white/10 relative">
                                            <audio src={inputAudio} controls className="w-full h-8" />
                                            <button onClick={() => setInputAudio(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white scale-75"><ClearIcon /></button>
                                        </div>
                                    )}
                                    <div className="mt-3 flex justify-center">
                                        <button onClick={() => activeRecorderState === 'studio' ? stopRecording() : startRecording('studio')} className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${activeRecorderState === 'studio' ? 'bg-red-500/20 text-red-500 border-red-500 animate-pulse' : 'bg-black border-studio-border hover:border-white'}`}>{activeRecorderState === 'studio' ? 'Parar Gravação' : 'Gravar'}</button>
                                    </div>
                                </>
                            ) : (
                                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Texto para inferência..." className="flex-1 w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-neon-secondary outline-none resize-none font-mono" />
                            )}
                        </div>

                        {/* DSP Settings */}
                        <div className="bg-black/40 p-4 rounded-xl border border-studio-border">
                            <label className="text-xs font-bold text-white uppercase tracking-widest mb-4 block flex items-center gap-2"><LightningIcon /> DSP Settings</label>
                            <div className="space-y-4">
                                {studioMode === 'svc' && (
                                    <div>
                                        <div className="flex justify-between text-[10px] mb-1 font-mono"><span className="text-studio-muted">PITCH (SEMITONES)</span><span className="text-neon-secondary">{params.pitch > 0 ? '+' : ''}{params.pitch}</span></div>
                                        <input type="range" min="-12" max="12" step="1" value={params.pitch} onChange={(e) => setParams({...params, pitch: parseInt(e.target.value)})} className="w-full accent-neon-secondary h-1 bg-studio-border rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                )}
                                <div>
                                    <div className="flex justify-between text-[10px] mb-1 font-mono"><span className="text-studio-muted">INDEX RATE</span><span className="text-white">{params.similarity}%</span></div>
                                    <input type="range" min="0" max="100" value={params.similarity} onChange={(e) => setParams({...params, similarity: parseInt(e.target.value)})} className="w-full accent-white h-1 bg-studio-border rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Output */}
                    <div className="lg:col-span-8 bg-black/20 border border-studio-border rounded-2xl p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                         <div className="absolute top-4 right-4 z-10">
                            {synthesisOutput && (
                                <button onClick={() => setSynthesisOutput(null)} className="text-xs text-studio-muted hover:text-white underline">
                                    Limpar / Resetar
                                </button>
                            )}
                         </div>

                         {isSynthesizing && (
                             <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm rounded-2xl">
                                 <div className="w-20 h-20 relative">
                                     <div className="absolute inset-0 border-4 border-neon-secondary/30 rounded-full"></div>
                                     <div className="absolute inset-0 border-4 border-t-neon-secondary rounded-full animate-spin"></div>
                                 </div>
                                 <p className="mt-4 text-neon-secondary font-mono tracking-widest animate-pulse">PROCESSANDO INFERÊNCIA NEURAL...</p>
                                 <p className="text-xs text-studio-muted mt-2">Latent Space Conversion • {studioMode === 'tts' && vocalStyle !== 'speech' ? 'Generating Melody' : 'Cloning Timbre'}</p>
                             </div>
                         )}

                         {!synthesisOutput ? (
                             <div className="text-center opacity-50 flex flex-col items-center">
                                 <div className="w-24 h-24 rounded-full border border-dashed border-white/20 flex items-center justify-center mx-auto mb-4">
                                     {studioMode === 'svc' ? <MusicIcon /> : <TextIcon />}
                                 </div>
                                 <button 
                                    onClick={handleSynthesis} 
                                    disabled={isButtonDisabled} 
                                    className={`mt-6 px-8 py-3 rounded-full font-bold uppercase tracking-widest transition-all ${isButtonDisabled ? 'bg-studio-border text-studio-muted cursor-not-allowed border border-white/5' : 'bg-neon-secondary text-white hover:bg-neon-secondary/80 hover:scale-105 shadow-neon-strong'}`}
                                 >
                                    {studioMode === 'svc' ? 'Iniciar Conversão (Convert)' : `Gerar ${vocalStyle !== 'speech' ? 'Música' : 'Fala'} (Synthesize)`}
                                 </button>
                                 {isButtonDisabled && (
                                     <p className="text-red-400 text-xs mt-3 font-mono bg-red-500/10 px-3 py-1 rounded border border-red-500/20">
                                         ⚠️ {disabledReason}
                                     </p>
                                 )}
                             </div>
                         ) : (
                             <div className="w-full h-full flex flex-col">
                                 <div className="flex-1 bg-studio-card/50 rounded-xl border border-white/5 p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                                     <div className="flex items-end gap-1 h-32 absolute bottom-0 left-0 right-0 opacity-20 group-hover:opacity-40 transition duration-1000 px-4 justify-center">
                                         {[...Array(20)].map((_,i) => (<div key={i} className="w-2 bg-neon-secondary rounded-t-sm animate-[pulse_1s_ease-in-out_infinite]" style={{height: `${Math.random()*100}%`, animationDelay: `${i*0.1}s`}}></div>))}
                                     </div>
                                     {synthesisOutput.audioUrl ? (
                                         <div className="z-10 w-full max-w-md text-center">
                                             <h3 className="text-2xl font-bold text-white mb-2 text-shadow-neon">Inferência Concluída</h3>
                                             <p className="text-xs text-studio-muted mb-4">{studioMode === 'tts' ? `Estilo: ${vocalStyle}` : 'Conversão SVC'}</p>
                                             <div className="bg-black/80 p-4 rounded-xl border border-neon-secondary/50 shadow-neon mb-6">
                                                 <audio src={synthesisOutput.audioUrl} controls className="w-full" autoPlay />
                                             </div>
                                             <div className="flex justify-center gap-4">
                                                <button onClick={() => setSynthesisOutput(null)} className="px-6 py-2 rounded-full border border-white/20 text-xs font-bold hover:bg-white hover:text-black transition">Nova Inferência</button>
                                                <a href={synthesisOutput.audioUrl} download={`rvc_output_${studioMode}.wav`} className="px-6 py-2 rounded-full bg-neon-secondary text-white text-xs font-bold hover:shadow-neon transition">Baixar .WAV</a>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="z-10 p-6 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-xs font-mono text-center">
                                             <p className="mb-4 font-bold">Erro de Geração:</p>
                                             <p>{synthesisOutput.text}</p>
                                             <button onClick={() => setSynthesisOutput(null)} className="mt-4 px-4 py-2 bg-white/10 rounded hover:bg-white/20 text-white">Tentar Novamente</button>
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
                <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-fade-in">
                    <div className="w-full bg-black/40 border border-studio-border p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-8">
                        {isTraining && (
                            <div className="absolute inset-0 bg-black/95 z-20 flex flex-col p-8 font-mono text-xs overflow-hidden">
                                <div className="flex justify-between items-end border-b border-white/10 pb-2 mb-4">
                                    <span className="text-neon-primary font-bold blink">root@prisma-rvc:~# train_model.py</span>
                                    <span className="text-white/50">{Math.round(trainingProgress)}%</span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 mb-4">
                                    {trainingLogs.map((log, i) => (
                                        <div key={i} className={`text-xs ${log.includes('Erro') ? 'text-red-500' : log.includes('concluído') ? 'text-green-400' : 'text-studio-muted'}`}>
                                            {log}
                                        </div>
                                    ))}
                                    <div ref={trainingLogsEndRef} />
                                </div>
                                <div className="h-16 border border-white/10 rounded p-2 bg-black">
                                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                                        <span>Epoch {currentEpoch}/{TOTAL_EPOCHS}</span>
                                        <span>GPU: Tesla T4 (Simulated)</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                        <div className="bg-neon-primary h-full transition-all duration-300" style={{width: `${trainingProgress}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex-1 space-y-6">
                            <div className="mb-4">
                                <h3 className="text-2xl font-bold text-white mb-1">Treino de Modelo RVC</h3>
                                <p className="text-sm text-studio-muted">Crie um dataset para clonagem neural.</p>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-white uppercase mb-2 block">1. Nome do Modelo</label>
                                <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Ex: Voz da Maria..." className="w-full bg-black border border-studio-border rounded-xl p-3 text-white focus:border-neon-primary outline-none" />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-white uppercase mb-2 block">2. Dataset (Áudio de Referência)</label>
                                <div className="flex flex-col gap-3">
                                    <div onClick={() => fileInputRef.current?.click()} className={`h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition ${trainingAudio ? 'border-neon-primary bg-neon-primary/10' : 'border-studio-border'}`}>
                                        {trainingAudio ? (
                                            <div className="flex items-center gap-2 text-neon-primary">
                                                <CheckIcon /> <span className="font-bold">Dataset Carregado</span>
                                            </div>
                                        ) : (
                                            <><UploadIcon /><span className="text-xs mt-2 text-studio-muted uppercase font-bold">Upload Wav/Mp3/Ogg/Flac</span></>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-px bg-white/10 flex-1"></div><span className="text-[10px] text-studio-muted uppercase">OU GRAVE AGORA</span><div className="h-px bg-white/10 flex-1"></div>
                                    </div>
                                    <button 
                                        onClick={() => activeRecorderState === 'training' ? stopRecording() : startRecording('training')} 
                                        className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${activeRecorderState === 'training' ? 'bg-red-500/20 text-red-500 border-red-500 animate-pulse' : 'bg-black border-studio-border text-white hover:border-white'}`}
                                    >
                                        {activeRecorderState === 'training' ? <><div className="w-2 h-2 bg-red-500 rounded-full"></div> Parar Gravação</> : <><MicIcon /> Gravar Dataset (Mic)</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="w-px bg-white/10 hidden md:block"></div>

                        <div className="flex-1 flex flex-col justify-between">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-neon-secondary uppercase tracking-widest">Configurações de Treino</h4>
                                <div className="bg-white/5 p-3 rounded-lg text-xs space-y-2 font-mono text-studio-muted">
                                    <div className="flex justify-between"><span>Sample Rate:</span><span className="text-white">48k</span></div>
                                    <div className="flex justify-between"><span>Target Epochs:</span><span className="text-white">{TOTAL_EPOCHS}</span></div>
                                    <div className="flex justify-between"><span>Batch Size:</span><span className="text-white">8 (GPU Optimized)</span></div>
                                    <div className="flex justify-between"><span>Version:</span><span className="text-white">v2 (RMVPE)</span></div>
                                </div>
                            </div>
                            <button 
                                onClick={handleTrainModel} 
                                disabled={!modelName || !trainingAudio} 
                                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all mt-6 ${!modelName || !trainingAudio ? 'bg-studio-border text-studio-muted' : 'bg-neon-primary text-white hover:bg-neon-primary/80 shadow-neon-strong hover:scale-[1.02]'}`}
                            >
                                Iniciar Treinamento Neural
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === TRANSCRIPTION MODE === */}
            {mode === 'transcription' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    <div className="space-y-6">
                        <div className="bg-black/40 border border-studio-border p-6 rounded-2xl text-center">
                            <h3 className="text-white font-bold mb-4">Input de Arquivo</h3>
                            {!transcriptionAudio ? (
                                <div className="flex justify-center gap-4">
                                     <button onClick={() => activeRecorderState === 'transcription' ? stopRecording() : startRecording('transcription')} className="p-4 rounded-full bg-black border border-studio-border hover:border-white transition flex items-center gap-2">{activeRecorderState === 'transcription' ? <span className="text-red-500 animate-pulse">● Rec</span> : <><MicIcon /><span className="text-white text-xs font-bold uppercase">Microfone</span></>}</button>
                                     <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full bg-black border border-studio-border hover:border-white transition text-white flex items-center gap-2"><UploadIcon /><span className="text-xs font-bold uppercase">Upload Áudio/ZIP</span></button>
                                </div>
                            ) : (
                                <div className="bg-studio-card p-4 rounded-xl border border-white/10 relative">
                                    {isTranscriptionZip ? (
                                        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-lg">
                                            <div className="p-3 bg-yellow-500/20 text-yellow-500 rounded-lg"><FileIcon /></div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-white">Arquivo Compactado (ZIP)</p>
                                                <p className="text-xs text-studio-muted">Pronto para análise</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <audio src={transcriptionAudio} controls className="w-full" />
                                    )}
                                    <button onClick={() => setTranscriptionAudio(null)} className="text-xs text-red-500 mt-2 underline block mx-auto">Remover Arquivo</button>
                                </div>
                            )}
                        </div>
                        <button onClick={async () => { if(!transcriptionAudio) return; setIsTranscribing(true); const res = await analyzeAudio(transcriptionAudio, transcriptionPrompt); setTranscriptionOutput(res); setIsTranscribing(false); }} disabled={!transcriptionAudio || isTranscribing} className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50">{isTranscribing ? 'Analisando...' : 'Transcrever / Analisar'}</button>
                    </div>
                    <div className="bg-black/40 border border-studio-border rounded-2xl p-6 overflow-y-auto">
                        <div className="prose prose-invert prose-sm">
                            <ReactMarkdown>{transcriptionOutput}</ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,.zip,.ogg,.flac,.mp3,.wav,application/zip,application/x-zip-compressed" onChange={(e) => {
            if (mode === 'rvc_studio' && studioMode === 'svc') handleFileUpload(e, setInputAudio);
            else if (mode === 'training') handleFileUpload(e, setTrainingAudio);
            else if (mode === 'transcription') handleFileUpload(e, setTranscriptionAudio);
            else if (mode === 'ai_cover') handleFileUpload(e, setCoverSong);
        }} />
    </div>
  );
};