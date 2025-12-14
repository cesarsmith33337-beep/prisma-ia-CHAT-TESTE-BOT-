import React, { useState } from 'react';
import { generateImageFromText } from '../services/gemini';
import { PaintIcon } from '../components/Icons';

export const ImageGeneration: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setImageUrl(null);
    setStatusText('');

    try {
      const result = await generateImageFromText(prompt);
      if (result.imageUrl) {
        setImageUrl(result.imageUrl);
      } else {
        setStatusText(result.text || "Falha na geração.");
      }
    } catch (e) {
      setStatusText("Erro no sistema.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="bg-studio-card/60 backdrop-blur-md p-8 rounded-3xl border border-studio-border h-full relative overflow-hidden shadow-neon-border">
        
        <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-neon-primary/10 rounded-xl text-neon-primary border border-neon-primary/20"><PaintIcon /></div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Estúdio Visual</h2>
                <p className="text-sm text-studio-muted">Renderização Holográfica de Texto</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100%-80px)]">
          {/* Input */}
          <div className="flex flex-col gap-4">
            <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-bold text-neon-secondary uppercase tracking-widest">Prompt</label>
                <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-full bg-[#050505] border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-studio-muted font-mono outline-none resize-none transition-all duration-300 shadow-inner focus:bg-black focus:border-neon-primary focus:shadow-[0_0_20px_rgba(217,70,239,0.2)]"
                placeholder="Descreva detalhadamente a imagem que deseja criar..."
                />
            </div>
            <button
              onClick={handleGenerate}
              disabled={!prompt || isLoading}
              className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                !prompt || isLoading
                  ? 'bg-studio-border text-studio-muted cursor-not-allowed'
                  : 'bg-black text-white border border-neon-primary hover:bg-neon-primary/10 hover:shadow-neon-strong'
              }`}
            >
              {isLoading ? 'Renderizando...' : 'Gerar Imagem'}
            </button>
          </div>

          {/* Output */}
          <div className="flex flex-col">
             <label className="text-xs font-bold text-neon-secondary uppercase tracking-widest mb-2">Preview</label>
             <div className="flex-1 border border-studio-border rounded-2xl bg-black flex items-center justify-center overflow-hidden relative shadow-inner">
               {isLoading ? (
                 <div className="flex flex-col items-center gap-4">
                   <div className="w-10 h-10 border-2 border-neon-primary border-t-transparent rounded-full animate-spin shadow-neon"></div>
                   <p className="text-neon-primary text-xs font-mono animate-pulse">Processando pixels...</p>
                 </div>
               ) : imageUrl ? (
                 <img src={imageUrl} alt="Generated" className="w-full h-full object-contain animate-fade-in" />
               ) : (
                 <div className="text-studio-muted text-sm text-center px-8 opacity-40">
                   A imagem gerada aparecerá aqui.
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};