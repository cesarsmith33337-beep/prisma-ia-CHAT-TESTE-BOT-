import React, { useState } from 'react';
import { generateEbookStory, generateImageFromText, generateClonedTTS } from '../services/gemini';
import { BookIcon, SparklesIcon, PaintIcon, AudioIcon, SaveIcon, CheckIcon, MaleIcon, FemaleIcon } from '../components/Icons';
import { EbookProject } from '../types';

declare global {
  interface Window {
    JSZip: any;
    saveAs: any;
  }
}

export const EbookStudio: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [project, setProject] = useState<EbookProject | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: Input, 1: Generating Text, 2: Review, 3: Generating Assets, 4: Finished
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedVoice, setSelectedVoice] = useState<'male_grave' | 'female_sexy'>('male_grave');
  
  const [isGenerating, setIsGenerating] = useState(false);

  // Step 1: Create Story Structure
  const handleCreateStory = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setCurrentStep(1);
    
    const ebookStructure = await generateEbookStory(topic);
    if (ebookStructure) {
        setProject(ebookStructure);
        setCurrentStep(2);
    } else {
        alert("Erro ao criar a história. Tente novamente.");
        setCurrentStep(0);
    }
    setIsGenerating(false);
  };

  // Step 2: Generate Images and Audio
  const handleGenerateAssets = async () => {
    if (!project) return;
    setIsGenerating(true);
    setCurrentStep(3);
    
    // Total items to generate = (Pages * 2) (1 Image + 1 Audio per page)
    const totalItems = project.pages.length * 2;
    setProgress({ current: 0, total: totalItems });

    const newPages = [...project.pages];
    let completed = 0;

    for (let i = 0; i < newPages.length; i++) {
        const page = newPages[i];
        
        // 1. Generate Image
        try {
            const imgRes = await generateImageFromText(page.imagePrompt);
            newPages[i].imageUrl = imgRes.imageUrl;
        } catch(e) { console.error("Img Gen Error", e); }
        completed++;
        setProgress({ current: completed, total: totalItems });

        // 2. Generate Audio (Narrator with Selected Voice)
        try {
             // Pass dummy base64 for target voice since we use specific IDs now
             const audioRes = await generateClonedTTS(
                "data:audio/mp3;base64,PLACEHOLDER", 
                page.text,
                { pitch: 0, breathiness: 0, reverb: 0, similarity: 0, speed: 1 },
                "speech",
                selectedVoice // Pass selected voice ID
             );
             newPages[i].audioUrl = audioRes.audioUrl;

        } catch(e) { console.error("Audio Gen Error", e); }
        completed++;
        setProgress({ current: completed, total: totalItems });
    }

    setProject({ ...project, pages: newPages });
    setIsGenerating(false);
    setCurrentStep(4);
  };

  // Step 3: Download ZIP
  const handleDownloadZip = async () => {
    if (!project || !window.JSZip) {
        alert("Biblioteca de ZIP não carregada ou projeto vazio.");
        return;
    }

    const zip = new window.JSZip();
    const folderName = project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const folder = zip.folder(folderName);

    // 1. Create HTML Index
    let htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${project.title}</title>
            <style>
                body { font-family: 'Georgia', serif; background: #fdf6e3; color: #333; padding: 40px; max-width: 800px; mx: auto; }
                .page { margin-bottom: 60px; border-bottom: 1px solid #ccc; padding-bottom: 40px; text-align: center; }
                img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 20px 0; }
                p { font-size: 1.2em; line-height: 1.6; }
                h1 { color: #2c3e50; }
                audio { width: 100%; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h1>${project.title}</h1>
            <h3>Tema: ${project.topic}</h3>
    `;

    project.pages.forEach((page, index) => {
        const imgFileName = `image_${index + 1}.png`;
        const audioFileName = `audio_${index + 1}.wav`;
        
        // Add files to ZIP
        if (page.imageUrl) {
            folder.file(imgFileName, page.imageUrl.split(',')[1], {base64: true});
        }
        if (page.audioUrl) {
            folder.file(audioFileName, page.audioUrl.split(',')[1], {base64: true});
        }

        htmlContent += `
            <div class="page">
                <p><strong>Página ${index + 1}</strong></p>
                ${page.imageUrl ? `<img src="${imgFileName}" alt="Ilustração Página ${index+1}">` : ''}
                <p>${page.text}</p>
                ${page.audioUrl ? `<audio controls src="${audioFileName}"></audio>` : ''}
            </div>
        `;
    });

    htmlContent += `</body></html>`;
    folder.file("index.html", htmlContent);

    // Generate ZIP
    const content = await zip.generateAsync({type:"blob"});
    window.saveAs(content, `${folderName}.zip`);
  };

  return (
    <div className="h-full bg-studio-card/80 backdrop-blur-md p-8 rounded-3xl border border-studio-border flex flex-col shadow-neon-border overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 shrink-0">
            <div className="p-3 bg-neon-secondary/10 rounded-xl text-neon-secondary border border-neon-secondary/20 shadow-neon"><BookIcon /></div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-wide">E-book Studio</h2>
                <p className="text-xs text-studio-muted">Criação Multimodal: Texto + Imagem + Áudio</p>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {/* STEP 0: INPUT */}
            {currentStep === 0 && (
                <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center space-y-8 animate-fade-in">
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Sobre o que será seu livro?</h3>
                        <input 
                            type="text" 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Ex: Uma capivara cibernética que viaja no tempo..."
                            className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-center text-white placeholder-white/30 focus:border-neon-primary outline-none transition-all text-lg"
                        />
                    </div>

                    <div className="w-full">
                        <p className="text-sm font-bold text-white/70 mb-4 uppercase tracking-widest text-center">Selecione o Narrador</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setSelectedVoice('male_grave')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${selectedVoice === 'male_grave' ? 'bg-neon-secondary/20 border-neon-secondary shadow-neon' : 'bg-black/40 border-white/10 hover:bg-white/5'}`}
                            >
                                <div className="p-2 bg-white/10 rounded-full"><MaleIcon /></div>
                                <span className="font-bold text-sm">Masculina Grave</span>
                                <span className="text-[10px] text-white/50">Profunda & Autoritária</span>
                            </button>

                            <button 
                                onClick={() => setSelectedVoice('female_sexy')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${selectedVoice === 'female_sexy' ? 'bg-neon-primary/20 border-neon-primary shadow-neon' : 'bg-black/40 border-white/10 hover:bg-white/5'}`}
                            >
                                <div className="p-2 bg-white/10 rounded-full"><FemaleIcon /></div>
                                <span className="font-bold text-sm">Feminina Suave</span>
                                <span className="text-[10px] text-white/50">Sexy & Atraente</span>
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={handleCreateStory}
                        className="bg-gradient-to-r from-neon-primary to-neon-secondary px-8 py-3 rounded-full font-bold text-white shadow-neon hover:scale-105 transition-all mt-4"
                    >
                        Criar Roteiro Mágico
                    </button>
                </div>
            )}

            {/* STEP 1: GENERATING TEXT */}
            {currentStep === 1 && (
                <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                    <div className="w-16 h-16 border-4 border-neon-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-neon-primary font-mono tracking-widest">Escrevendo história...</p>
                </div>
            )}

            {/* STEP 2: REVIEW TEXT */}
            {currentStep === 2 && project && (
                <div className="animate-fade-in space-y-6">
                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-bold text-white text-shadow-neon">{project.title}</h2>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <p className="text-sm text-studio-muted">Narrador Selecionado:</p>
                            <span className={`text-xs font-bold px-2 py-1 rounded bg-white/10 ${selectedVoice === 'male_grave' ? 'text-neon-secondary' : 'text-neon-primary'}`}>
                                {selectedVoice === 'male_grave' ? 'Masculina Grave' : 'Feminina Sexy'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {project.pages.map((page) => (
                            <div key={page.pageNumber} className="bg-black/40 border border-white/10 p-4 rounded-xl">
                                <span className="text-xs font-bold text-neon-secondary uppercase mb-2 block">Página {page.pageNumber}</span>
                                <p className="text-sm text-white/90 italic mb-4">"{page.text}"</p>
                                <div className="bg-white/5 p-2 rounded text-[10px] text-studio-muted font-mono border-l-2 border-neon-primary">
                                    Prompt Sugerido: {page.imagePrompt.substring(0, 60)}...
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center mt-8">
                        <button 
                            onClick={handleGenerateAssets}
                            className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center gap-2"
                        >
                            <SparklesIcon /> Gerar Imagens e Áudio (Renderizar)
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: GENERATING ASSETS */}
            {currentStep === 3 && (
                <div className="flex flex-col items-center justify-center h-full animate-fade-in max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-white mb-4">Renderizando o Universo...</h3>
                    <div className="w-full bg-white/10 rounded-full h-4 mb-2 overflow-hidden">
                        <div 
                            className="bg-neon-primary h-full transition-all duration-300" 
                            style={{width: `${(progress.current / progress.total) * 100}%`}}
                        ></div>
                    </div>
                    <p className="text-xs text-studio-muted font-mono">
                        Gerando {progress.current} de {progress.total} assets (Imagens + Vozes)
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-4 opacity-50">
                        <div className="flex flex-col items-center gap-2 text-neon-secondary animate-pulse">
                            <PaintIcon /> <span className="text-[10px]">Pintando...</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 text-neon-secondary animate-pulse delay-100">
                            <AudioIcon /> <span className="text-[10px]">Narrando...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: FINISHED & DOWNLOAD */}
            {currentStep === 4 && project && (
                <div className="animate-fade-in space-y-8">
                     <div className="flex justify-between items-center bg-green-500/10 border border-green-500/30 p-4 rounded-xl">
                        <div>
                            <h3 className="font-bold text-green-400 flex items-center gap-2"><CheckIcon /> E-book Finalizado!</h3>
                            <p className="text-xs text-green-200/60">Todas as páginas foram ilustradas e narradas.</p>
                        </div>
                        <button 
                            onClick={handleDownloadZip}
                            className="bg-green-500 hover:bg-green-400 text-black px-6 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                        >
                            <SaveIcon /> Baixar ZIP Completo
                        </button>
                    </div>

                    <div className="space-y-12">
                        {project.pages.map((page) => (
                            <div key={page.pageNumber} className="flex flex-col md:flex-row gap-8 items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                <div className="flex-1 space-y-4">
                                    <h4 className="text-neon-primary font-bold tracking-widest text-sm">PÁGINA {page.pageNumber}</h4>
                                    <p className="text-lg md:text-xl font-serif leading-relaxed text-white/90">
                                        {page.text}
                                    </p>
                                    {page.audioUrl && (
                                        <div className="bg-black/40 p-3 rounded-xl border border-white/10">
                                            <audio src={page.audioUrl} controls className="w-full h-8" />
                                        </div>
                                    )}
                                </div>
                                <div className="w-full md:w-1/2 aspect-square md:aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 relative group">
                                    {page.imageUrl ? (
                                        <img src={page.imageUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-studio-muted text-xs">Erro na imagem</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="h-20 flex items-center justify-center">
                        <button onClick={() => { setProject(null); setTopic(''); setCurrentStep(0); }} className="text-white/50 hover:text-white underline text-sm">
                            Criar Novo Livro
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};