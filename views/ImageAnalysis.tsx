import React, { useState, useRef } from 'react';
import { UploadIcon, ClearIcon, ImageIcon } from '../components/Icons';
import { analyzeMedia } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

export const ImageAnalysis: React.FC = () => {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVid = file.type.startsWith('video/');
      setIsVideo(isVid);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedMedia(reader.result as string);
        setOutput('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
        setIsVideo(file.type.startsWith('video/'));
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedMedia(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMedia) return;
    setIsLoading(true);
    setOutput('');
    
    try {
      const result = await analyzeMedia(selectedMedia, prompt, isVideo);
      setOutput(result);
    } catch (error) {
      setOutput("Erro na análise. O arquivo pode ser muito grande.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    setSelectedMedia(null);
    setIsVideo(false);
    setPrompt('');
    setOutput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full bg-studio-card/60 backdrop-blur-md p-8 rounded-3xl border border-studio-border flex flex-col shadow-neon-border">
        <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-neon-secondary/10 rounded-xl text-neon-secondary border border-neon-secondary/20 shadow-[0_0_10px_rgba(139,92,246,0.2)]"><ImageIcon /></div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Análise de Mídia</h2>
                <p className="text-sm text-studio-muted">Visão Computacional & Entendimento de Vídeo</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
          {/* Input Section */}
          <div className="flex flex-col gap-6">
            
            {/* Uploader */}
            <div 
              className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer relative overflow-hidden bg-black/40 group ${
                selectedMedia 
                  ? 'border-neon-primary/50 shadow-neon' 
                  : 'border-studio-border hover:border-neon-primary/50 hover:bg-neon-primary/5 hover:shadow-neon-border'
              }`}
              onClick={() => !selectedMedia && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {selectedMedia ? (
                <>
                  {isVideo ? (
                      <video src={selectedMedia} controls className="h-full w-full object-contain p-4 max-h-[300px]" />
                  ) : (
                      <img src={selectedMedia} alt="Preview" className="h-full w-full object-contain p-4" />
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); clearAll(); }}
                    className="absolute top-4 right-4 bg-black/80 p-2 rounded-full text-white hover:text-red-400 hover:shadow-neon backdrop-blur-md border border-white/10 transition-all"
                  >
                    <ClearIcon />
                  </button>
                </>
              ) : (
                <div className="text-center p-6 group-hover:scale-105 transition-transform duration-300">
                  <div className="bg-studio-card text-studio-muted p-4 rounded-full inline-flex mb-4 border border-studio-border group-hover:text-neon-primary group-hover:border-neon-primary/50 group-hover:shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all">
                    <UploadIcon />
                  </div>
                  <p className="text-sm font-bold text-white tracking-wide">Upload de Mídia</p>
                  <p className="text-[10px] text-studio-muted mt-2 font-mono uppercase">Imagens & Vídeos Curtos</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </div>

            {/* Prompt Input */}
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full border border-studio-border rounded-xl p-4 text-sm focus:ring-1 focus:ring-neon-primary focus:border-neon-primary focus:shadow-neon outline-none bg-black/50 text-white placeholder-studio-muted resize-none font-mono transition-all"
                placeholder={isVideo ? "O que acontece neste vídeo?" : "O que você quer saber sobre esta imagem?"}
                rows={3}
              />
            </div>

            <div className="flex gap-4">
                <button
                    onClick={handleSubmit}
                    disabled={!selectedMedia || isLoading}
                    className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                        !selectedMedia || isLoading
                        ? 'bg-studio-border text-studio-muted cursor-not-allowed'
                        : 'bg-black text-white border border-neon-primary hover:bg-neon-primary/20 hover:shadow-neon-strong'
                    }`}
                >
                    {isLoading ? 'Analisando...' : 'Executar Análise'}
                </button>
                <button 
                    onClick={clearAll}
                    className="px-6 py-3 border border-studio-border rounded-xl text-studio-muted hover:text-white hover:border-white/20 hover:bg-white/5 transition text-sm font-medium"
                >
                    Limpar
                </button>
            </div>
          </div>

          {/* Output Section */}
          <div className="flex flex-col h-full bg-black/40 border border-studio-border rounded-2xl overflow-hidden shadow-inner">
            <div className="p-4 border-b border-studio-border bg-studio-card/50">
                <span className="text-xs font-bold text-neon-secondary uppercase tracking-widest">Resultados</span>
            </div>
            <div className={`flex-1 p-6 overflow-y-auto custom-scrollbar ${!output && 'flex items-center justify-center'}`}>
                {isLoading ? (
                    <div className="flex flex-col items-center text-neon-primary animate-pulse gap-3">
                        <div className="w-8 h-8 border-2 border-neon-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-mono tracking-widest">Processando dados visuais...</span>
                    </div>
                ) : output ? (
                    <div className="prose prose-sm prose-invert prose-p:text-studio-text prose-headings:text-white prose-strong:text-neon-primary max-w-none font-sans">
                        <ReactMarkdown>{output}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="text-studio-muted text-sm italic text-center px-8 opacity-40">
                        Os resultados da análise aparecerão aqui.
                    </div>
                )}
            </div>
          </div>
        </div>
    </div>
  );
};