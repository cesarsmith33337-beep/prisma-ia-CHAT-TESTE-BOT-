import React, { useState } from 'react';
import { ViewType, DemoConfig } from './types';
import { ChatIcon, ImageIcon, TextIcon, AudioIcon, PaintIcon, LightningIcon, WindIcon, EyeOffIcon, PaletteIcon } from './components/Icons';
import { ChatInterface } from './views/ChatInterface';
import { ImageAnalysis } from './views/ImageAnalysis';
import { ImageGeneration } from './views/ImageGeneration';
import { AudioAnalysis } from './views/AudioAnalysis';
import { TextSummary } from './views/TextSummary';

type Theme = 'cyberpunk' | 'storm' | 'aurora' | 'stealth';

const demos: DemoConfig[] = [
  {
    id: ViewType.CHAT,
    title: "Chat",
    description: "Assistente Neural",
    icon: <ChatIcon />
  },
  {
    id: ViewType.IMAGE_GENERATION,
    title: "Gerar Imagem",
    description: "Estúdio Visual",
    icon: <PaintIcon />
  },
  {
    id: ViewType.IMAGE_ANALYSIS,
    title: "Análise Visual",
    description: "Visão Computacional",
    icon: <ImageIcon />
  },
  {
    id: ViewType.AUDIO_ANALYSIS,
    title: "Áudio & Voz",
    description: "Processador Sônico",
    icon: <AudioIcon />
  },
  {
    id: ViewType.TEXT_SUMMARY,
    title: "Texto",
    description: "Resumo e Tradução",
    icon: <TextIcon />
  }
];

// Neon Logo Component
const PrismaLogo = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2L37.3205 12V32L20 42L2.67949 32V12L20 2Z" stroke="currentColor" strokeWidth="2" className="text-neon-primary fill-neon-primary/10" />
    <path d="M20 8L31 15V29L20 36L9 29V15L20 8Z" stroke="currentColor" strokeWidth="1.5" className="text-neon-secondary" />
    <path d="M20 15L25 18V25L20 28L15 25V18L20 15Z" className="text-neon-primary fill-current animate-pulse" />
  </svg>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.CHAT);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('cyberpunk');

  const toggleTheme = () => {
    setTheme(prev => {
        if (prev === 'cyberpunk') return 'storm';
        if (prev === 'storm') return 'aurora';
        if (prev === 'aurora') return 'stealth';
        return 'cyberpunk';
    });
  };

  const getThemeClass = () => {
      switch(theme) {
          case 'storm': return 'theme-storm bg-storm';
          case 'aurora': return 'theme-aurora bg-aurora';
          case 'stealth': return 'theme-stealth bg-stealth';
          default: return 'bg-cyberpunk';
      }
  }

  const getSystemStatus = () => {
      switch(theme) {
          case 'storm': return 'SYSTEM: OVERDRIVE';
          case 'aurora': return 'SYSTEM: ETHEREAL';
          case 'stealth': return 'SYSTEM: CLASSIFIED';
          default: return 'SYSTEM: STABLE';
      }
  }

  const getThemeIcon = () => {
      switch(theme) {
          case 'storm': return <LightningIcon />;
          case 'aurora': return <WindIcon />;
          case 'stealth': return <EyeOffIcon />;
          default: return <PaletteIcon />; // Default Cyberpunk
      }
  }

  const getThemeName = () => {
    switch(theme) {
        case 'storm': return 'Tempestade';
        case 'aurora': return 'Aurora';
        case 'stealth': return 'Stealth';
        default: return 'Cyberpunk';
    }
  }

  const renderView = () => {
    switch (currentView) {
      case ViewType.CHAT:
        return <ChatInterface />;
      case ViewType.IMAGE_ANALYSIS:
        return <ImageAnalysis />;
      case ViewType.IMAGE_GENERATION:
        return <ImageGeneration />;
      case ViewType.AUDIO_ANALYSIS:
        return <AudioAnalysis />;
      case ViewType.TEXT_SUMMARY:
        return <TextSummary />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className={`flex h-screen font-sans text-studio-text overflow-hidden selection:bg-neon-primary/30 selection:text-white transition-colors duration-500 ${getThemeClass()}`}>
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[280px] bg-black/60 backdrop-blur-xl border-r border-studio-border flex-col z-20 shrink-0 transition-colors duration-500 shadow-2xl">
        <div className="p-8 pb-4">
          {/* Neon Logo Area */}
          <div className="flex items-center gap-4 mb-8">
            <div className="drop-shadow-[0_0_10px_var(--neon-glow)] transition-all duration-500">
               <PrismaLogo />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight text-white leading-none font-logo drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                PRISMA <span className="text-neon-primary font-extrabold transition-colors duration-500">IA</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-2 mb-4">
             <div className="text-[10px] font-bold text-neon-secondary uppercase tracking-[0.2em] transition-colors duration-500">Módulos</div>
             <button 
                onClick={toggleTheme}
                className="p-2 rounded-full border border-studio-border hover:border-neon-primary/50 text-studio-muted hover:text-white hover:bg-neon-primary/10 transition-all duration-300 group flex items-center gap-2"
                title={`Tema Atual: ${getThemeName()}`}
             >
                <div className={`transition-transform duration-500 ${theme !== 'stealth' ? 'text-neon-primary drop-shadow-[0_0_8px_var(--neon-primary)]' : 'text-white'}`}>
                    {getThemeIcon()}
                </div>
             </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {demos.map((demo) => (
            <button
              key={demo.id}
              onClick={() => setCurrentView(demo.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden ${
                currentView === demo.id
                  ? 'bg-studio-card text-white shadow-neon-border border border-neon-primary/30'
                  : 'bg-transparent text-studio-muted hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
              }`}
            >
              {/* Glow Effect for Active State */}
              {currentView === demo.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-primary/10 to-transparent pointer-events-none transition-colors duration-500" />
              )}

              <span className={`transition-all duration-300 ${currentView === demo.id ? 'text-neon-primary drop-shadow-[0_0_8px_var(--neon-glow)]' : 'group-hover:text-neon-secondary'}`}>
                {demo.icon}
              </span>
              <span className="leading-none tracking-wide z-10">{demo.title}</span>
            </button>
          ))}
        </nav>

        {/* Footer Area */}
        <div className="p-6">
            <div className={`text-[10px] text-center font-mono transition-colors duration-500 ${theme === 'stealth' ? 'text-studio-muted' : 'text-neon-secondary/50'}`}>
                {getSystemStatus()}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Mobile Header */}
        <div className="md:hidden p-4 bg-studio-panel/90 backdrop-blur-md border-b border-studio-border flex justify-between items-center z-30 transition-colors duration-500">
             <div className="flex items-center gap-2">
                <div className="scale-75"><PrismaLogo /></div>
                <h1 className="text-xl font-bold text-white font-logo tracking-tight">PRISMA <span className="text-neon-primary transition-colors duration-500">IA</span></h1>
             </div>
             <div className="flex gap-2">
                 <button onClick={toggleTheme} className="text-white p-2 rounded-full border border-white/10">
                    {getThemeIcon()}
                 </button>
                 <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-2">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                 </button>
             </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-studio-panel border-b border-studio-border z-40 p-4 shadow-neon transition-colors duration-500">
                 {demos.map((demo) => (
                    <button
                    key={demo.id}
                    onClick={() => { setCurrentView(demo.id); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors duration-300 ${
                        currentView === demo.id ? 'bg-studio-card text-neon-primary border border-neon-primary/30' : 'text-studio-muted'
                    }`}
                    >
                        {demo.icon} {demo.title}
                    </button>
                 ))}
            </div>
        )}

        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10">
          <div className="min-h-full max-w-6xl mx-auto w-full pb-10">
            {renderView()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;