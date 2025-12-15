import React, { useState } from 'react';
import { ViewType } from './types';
import { ChatInterface } from './views/ChatInterface';
import { ImageAnalysis } from './views/ImageAnalysis';
import { ImageGeneration } from './views/ImageGeneration';
import { AudioAnalysis } from './views/AudioAnalysis';
import { TextSummary } from './views/TextSummary';
import { EbookStudio } from './views/EbookStudio';
import { CloseIcon } from './components/Icons';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.CHAT);

  const renderView = () => {
    switch (currentView) {
      case ViewType.CHAT:
        return <ChatInterface onNavigate={setCurrentView} />;
      case ViewType.IMAGE_ANALYSIS:
        return (
            <ViewWrapper onBack={() => setCurrentView(ViewType.CHAT)} title="Análise de Mídia">
                <ImageAnalysis />
            </ViewWrapper>
        );
      case ViewType.IMAGE_GENERATION:
        return (
            <ViewWrapper onBack={() => setCurrentView(ViewType.CHAT)} title="Estúdio Visual">
                <ImageGeneration />
            </ViewWrapper>
        );
      case ViewType.AUDIO_ANALYSIS:
        return (
            <ViewWrapper onBack={() => setCurrentView(ViewType.CHAT)} title="Estúdio de Áudio">
                <AudioAnalysis />
            </ViewWrapper>
        );
      case ViewType.TEXT_SUMMARY:
        return (
            <ViewWrapper onBack={() => setCurrentView(ViewType.CHAT)} title="Ferramentas de Texto">
                <TextSummary />
            </ViewWrapper>
        );
      case ViewType.EBOOK_CREATOR:
        return (
            <ViewWrapper onBack={() => setCurrentView(ViewType.CHAT)} title="E-book Studio">
                <EbookStudio />
            </ViewWrapper>
        );
      default:
        return <ChatInterface onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="h-screen w-full bg-studio-base text-studio-text font-sans overflow-hidden selection:bg-neon-primary/30 selection:text-white relative">
        {/* Ambient Background Gradient */}
        <div className="absolute inset-0 bg-gradient-aurora pointer-events-none z-0"></div>
        
        <div className="relative z-10 h-full flex flex-col">
            {renderView()}
        </div>
    </div>
  );
};

// Wrapper modernizado com estilo de cabeçalho "App Bar"
const ViewWrapper: React.FC<{ children: React.ReactNode, onBack: () => void, title: string }> = ({ children, onBack, title }) => (
    <div className="h-full flex flex-col bg-studio-base/50">
        <header className="h-16 flex items-center justify-between px-6 border-b border-studio-border bg-studio-base/80 backdrop-blur-md sticky top-0 z-50">
             <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-2 rounded-full hover:bg-white/5 text-studio-muted hover:text-white transition-colors duration-200 group">
                     <CloseIcon /> 
                 </button>
                 <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                 <h2 className="font-display font-bold text-lg tracking-tight text-white">{title}</h2>
             </div>
             <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-neon-primary animate-pulse"></div>
                 <div className="text-[10px] text-studio-muted uppercase tracking-widest font-mono">Prisma OS</div>
             </div>
        </header>
        <div className="flex-1 overflow-hidden p-0 md:p-6">
            <div className="h-full max-w-[1600px] mx-auto animate-fade-in md:rounded-3xl overflow-hidden border border-transparent md:border-studio-border bg-transparent md:bg-studio-panel/30 md:backdrop-blur-md relative shadow-2xl">
                {children}
            </div>
        </div>
    </div>
);

export default App;