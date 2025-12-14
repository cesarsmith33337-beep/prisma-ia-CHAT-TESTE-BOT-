import React, { useState } from 'react';
import { generateText } from '../services/gemini';
import { TextIcon } from '../components/Icons';
import ReactMarkdown from 'react-markdown';

export const TextSummary: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'summarize' | 'translate' | 'simplify'>('summarize');

  const handleRun = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    
    let prompt = "";
    switch(mode) {
        case 'summarize':
            prompt = `Resuma o seguinte texto em português, destacando os pontos principais de forma estruturada:\n\n${inputText}`;
            break;
        case 'translate':
            prompt = `Traduza o seguinte texto para Português do Brasil mantendo o tom original (se já estiver, melhore a fluidez):\n\n${inputText}`;
            break;
        case 'simplify':
            prompt = `Reescreva o seguinte texto em linguagem extremamente simples e didática:\n\n${inputText}`;
            break;
    }

    try {
      const result = await generateText(prompt);
      setOutputText(result);
    } catch (e) {
      setOutputText("Erro no processamento.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-studio-card/60 backdrop-blur-md p-8 rounded-3xl border border-studio-border h-full flex flex-col shadow-neon-border">
       <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]"><TextIcon /></div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Núcleo de Texto</h2>
                <p className="text-sm text-studio-muted">Processamento de linguagem natural</p>
            </div>
        </div>

        <div className="flex gap-3 mb-6 bg-black/40 p-1.5 rounded-xl border border-studio-border w-fit">
            {(['summarize', 'translate', 'simplify'] as const).map((m) => (
                <button 
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-5 py-2 text-sm font-bold rounded-lg transition-all uppercase tracking-wide ${
                        mode === m 
                        ? 'bg-purple-600/20 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)] border border-purple-500/50' 
                        : 'text-studio-muted hover:text-white hover:bg-white/5'
                    }`}
                >
                    {m === 'summarize' ? 'Resumir' : m === 'translate' ? 'Traduzir' : 'Simplificar'}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
            {/* Input */}
            <div className="flex flex-col h-full">
                <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Input de Dados</label>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 w-full border border-studio-border rounded-2xl p-5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 focus:shadow-[0_0_15px_rgba(168,85,247,0.2)] outline-none bg-black/40 text-white placeholder-studio-muted resize-none font-mono transition-all custom-scrollbar"
                    placeholder="Cole seu texto aqui para processamento..."
                />
                <button
                    onClick={handleRun}
                    disabled={!inputText || isLoading}
                    className={`mt-6 w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                        !inputText || isLoading 
                        ? 'bg-studio-border text-studio-muted cursor-not-allowed' 
                        : 'bg-black text-white border border-purple-500 hover:bg-purple-500/20 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                    }`}
                >
                    {isLoading ? 'Processando...' : 'Executar Comando'}
                </button>
            </div>

            {/* Output */}
            <div className="flex flex-col h-full bg-black/40 border border-studio-border rounded-2xl overflow-hidden shadow-inner">
                <div className="p-4 border-b border-studio-border bg-studio-card/50">
                   <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Resultado do Processamento</span>
                </div>
                <div className="flex-1 w-full p-6 overflow-y-auto custom-scrollbar">
                    {outputText ? (
                         <div className="prose prose-sm prose-invert prose-p:text-studio-text prose-headings:text-white prose-strong:text-purple-400 max-w-none font-sans">
                            <ReactMarkdown>{outputText}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-studio-muted opacity-40">
                            <TextIcon />
                            <span className="text-xs mt-3 font-mono">Aguardando dados de entrada</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};