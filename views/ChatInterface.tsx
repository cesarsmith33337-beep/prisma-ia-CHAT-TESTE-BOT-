import React, { useState, useRef, useEffect } from 'react';
import { 
    SendIcon, ClearIcon, SaveIcon, HistoryIcon, TrashIcon, CloseIcon, WindIcon, 
    LightningIcon, EditIcon, CheckIcon, PlusIcon, VideoIcon, GlobeIcon, 
    MicIcon, PaintIcon, MusicIcon, SparklesIcon, SettingsIcon, MagicIcon, ChatIcon, BookIcon,
    CopyIcon, FileIcon, ImageIcon, EyeIcon
} from '../components/Icons';
import { streamChatResponse } from '../services/gemini';
import { Message, SavedSession, GroundingChunk, ViewType, Attachment } from '../types';
import ReactMarkdown from 'react-markdown';
import { ScreenCaptureControl } from '../components/ScreenCaptureControl';

type ChatMode = 'flash' | 'reasoning' | 'search' | 'creative';

interface ChatInterfaceProps {
    onNavigate?: (view: ViewType) => void;
}

// Logo Component (Mini)
const PrismaLogoSmall = () => (
  <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2L37.3205 12V32L20 42L2.67949 32V12L20 2Z" stroke="currentColor" strokeWidth="3" className="text-neon-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
  </svg>
);

// BROWSER FRAME COMPONENT
const BrowserFrame = ({ initialUrl, onAnalyze }: { initialUrl: string, onAnalyze: (base64: string) => void }) => {
    const [currentUrl, setCurrentUrl] = useState(initialUrl);
    const [displayUrl, setDisplayUrl] = useState(initialUrl);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const isRestrictedSite = (url: string) => {
        const restricted = ['pocketoption', 'iqoption', 'google', 'facebook', 'instagram', 'twitter', 'quotex', 'binomo', 'youtube', 'whatsapp'];
        return restricted.some(r => url.toLowerCase().includes(r));
    };

    const [showGateway, setShowGateway] = useState(isRestrictedSite(initialUrl));

    useEffect(() => {
        let normalized = initialUrl;
        if (!normalized.startsWith('http')) normalized = 'https://' + normalized;
        setCurrentUrl(normalized);
        setDisplayUrl(normalized);
        setShowGateway(isRestrictedSite(normalized));
    }, [initialUrl]);

    const openAsApp = () => {
        const width = 1200;
        const height = 900;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        window.open(currentUrl, '_blank', `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left},popup=yes`);
    };

    const captureScreen = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();
            await new Promise(r => setTimeout(r, 500));
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            stream.getTracks().forEach(t => t.stop());
            onAnalyze(base64);
        } catch (err) { console.error(err); }
    }

    const handleNavigate = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            let url = displayUrl;
            if (!url.startsWith('http')) url = 'https://' + url;
            setCurrentUrl(url);
            setDisplayUrl(url); 
            setShowGateway(isRestrictedSite(url));
        }
    };

    return (
        <div className="w-full h-[500px] flex flex-col rounded-xl overflow-hidden border border-studio-border bg-[#202124] shadow-2xl my-4 animate-fade-in ring-1 ring-white/5 group font-sans">
            <div className="bg-[#35363a] p-2 flex items-center gap-3 border-b border-[#000000]">
                <div className="flex gap-2 ml-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] cursor-pointer" onClick={openAsApp} title="Maximizar App"></div>
                </div>
                <div className="flex-1 bg-[#202124] rounded-full h-8 flex items-center px-4 mx-2 border border-[#5f6368]/30">
                    <div className={`text-xs mr-2 text-green-500`}><GlobeIcon /></div>
                    <input 
                        value={displayUrl} 
                        onChange={(e) => setDisplayUrl(e.target.value)}
                        onKeyDown={handleNavigate}
                        className="bg-transparent text-sm text-white/90 w-full outline-none font-sans"
                        placeholder="Digite uma URL..."
                    />
                </div>
                <button onClick={captureScreen} className="p-1.5 px-3 bg-white/10 text-white rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 hover:bg-white/20">
                    <EyeIcon /> Print
                </button>
            </div>
            <div className="flex-1 relative bg-white overflow-hidden">
                {showGateway ? (
                    <div className="absolute inset-0 bg-[#2d2e31] flex flex-col items-center justify-center text-center p-8">
                         <div className="w-20 h-20 bg-studio-card rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl mb-4"><GlobeIcon /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Modo App Externo</h3>
                        <p className="text-sm text-white/60 max-w-md mb-8">Este site requer uma janela segura.</p>
                        <button onClick={openAsApp} className="px-8 py-4 bg-neon-primary text-white font-bold rounded-full shadow-neon">🚀 Abrir Site</button>
                    </div>
                ) : (
                    <iframe ref={iframeRef} src={currentUrl} className="w-full h-full border-none" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation" allowFullScreen onError={() => setShowGateway(true)} />
                )}
            </div>
        </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('flash');
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Attachments
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Trading State
  const [isTradingMode, setIsTradingMode] = useState(false);
  const [tradingTimeframe, setTradingTimeframe] = useState<'1M' | '5M' | '15M'>('1M');

  // Feedback visual
  const [micActive, setMicActive] = useState(false);

  // Editing
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('prisma_chat_history');
    if (stored) {
        try { setSavedSessions(JSON.parse(stored)); } catch (e) { console.error("Failed to load history"); }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (overrideText?: string, overrideAttachment?: Attachment) => {
    const textToSend = overrideText || inputValue;
    const attachmentToSend = overrideAttachment || attachment;

    if ((!textToSend.trim() && !attachmentToSend) || isLoading) return;

    const userMsg: Message = { 
        role: 'user', 
        text: textToSend,
        attachment: attachmentToSend || undefined
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!overrideText) setInputValue('');
    if (!overrideAttachment) setAttachment(null); 
    setIsLoading(true);

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
        activeSessionId = Date.now().toString();
        setCurrentSessionId(activeSessionId);
    }

    try {
      const history = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }] 
      }));

      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      let fullText = '';
      let allGroundingChunks: GroundingChunk[] = [];

      // Logic to determine API Mode
      // If Trading Mode is active, force 'reasoning' (Pro) to enable both Vision and Search tools.
      const apiMode = (attachmentToSend?.type === 'image' || chatMode === 'creative' || isTradingMode) ? 'reasoning' : chatMode;
      const stream = streamChatResponse(history, userMsg.text, apiMode as any, userMsg.attachment);

      for await (const chunk of stream) {
        if (chunk.text) fullText += chunk.text;
        if (chunk.groundingChunks) {
            allGroundingChunks = [...allGroundingChunks, ...chunk.groundingChunks];
        }

        setMessages(prev => {
          const newHistory = [...prev];
          const lastMsg = newHistory[newHistory.length - 1];
          if (lastMsg.role === 'model') {
            lastMsg.text = fullText;
            if (allGroundingChunks.length > 0) {
                lastMsg.groundingChunks = allGroundingChunks;
            }
          }
          return newHistory;
        });
      }
      
      saveSessionData(activeSessionId, newMessages, fullText);

    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Erro de conexão.', isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Callback para Print Único
  const handleBrowserAnalysis = (base64Image: string) => {
      const screenAttachment: Attachment = {
          type: 'image',
          mimeType: 'image/jpeg',
          data: base64Image,
          name: 'snapshot.jpg'
      };
      
      handleSend(
          "Analise este gráfico/tela com visão computacional E busque na web (Prisma Mode) informações recentes sobre o que está na tela. Combine técnica + notícias.", 
          screenAttachment
      );
  };

  // Callback para o LIVE TRADING BOT
  const handleLiveFrame = (base64Image: string) => {
      if (isLoading) return; // Evita sobrecarga se já estiver analisando

      const screenAttachment: Attachment = {
          type: 'image',
          mimeType: 'image/jpeg',
          data: base64Image.split(',')[1],
          name: `live_candle_${Date.now()}.jpg`
      };

      const monitorPrompt = `
      MONITORAMENTO DE MERCADO (PRISMA TRADER ATIVO):
      
      1. ANALISE este frame gráfico visualmente (Velas, Tendência, RSI). Timeframe Configurado: ${tradingTimeframe}.
      2. **IMPORTANTE:** Se houver um cronômetro ou contagem regressiva visível na vela, leia-o e considere o tempo restante para o fechamento.
      3. USE O GOOGLE SEARCH para buscar AGORA notícias urgentes (últimos 15 min) sobre este ativo.
      4. CRUZE os dados (Técnico + Fundamentalista).
      
      Conclusão Rápida:
      - Viés: COMPRA 🟢 / VENDA 🔴 / NEUTRO ⚪
      - Confiança: %
      - Motivo Principal: (Ex: "RSI Baixo + Notícia Positiva + Faltam 10s para fechar")
      `;

      handleSend(monitorPrompt, screenAttachment);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          let type: 'image' | 'video' | 'audio' | 'text' | 'file' = 'text';
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type.startsWith('audio/')) type = 'audio';
          else type = 'text'; 

          if (type === 'image' || type === 'video' || type === 'audio') {
             const base64Data = (reader.result as string).split(',')[1];
             setAttachment({
                 type: type,
                 mimeType: file.type,
                 data: base64Data,
                 name: file.name
             });
          }
      };
      reader.readAsDataURL(file); 
      e.target.value = ''; 
  };

  const clearAttachment = () => setAttachment(null);
  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const saveSessionData = (id: string, msgs: Message[], lastResponse: string) => {
      const cleanText = (txt: string) => txt.replace(/[*_#`\[\]]/g, '').replace(/\s+/g, ' ').trim();
      const firstUserMsg = msgs.find(m => m.role === 'user');
      const defaultTitle = firstUserMsg ? cleanText(firstUserMsg.text).slice(0, 30) : 'Nova Conversa';
      const previewText = cleanText(lastResponse).slice(0, 50) + (lastResponse.length > 50 ? '...' : '');
      
      const existingSession = savedSessions.find(s => s.id === id);
      const title = existingSession?.title || defaultTitle; 

      const newSession: SavedSession = {
          id,
          title,
          summary: previewText,
          date: new Date().toISOString(),
          preview: previewText,
          messages: [...msgs, {role: 'model', text: lastResponse}]
      };

      const updated = existingSession 
        ? savedSessions.map(s => s.id === id ? newSession : s)
        : [newSession, ...savedSessions];
      
      setSavedSessions(updated);
      localStorage.setItem('prisma_chat_history', JSON.stringify(updated));
  };

  const handleNewChat = () => {
      setMessages([]);
      setCurrentSessionId(null);
      setInputValue('');
  };

  const loadSession = (session: SavedSession) => {
      setMessages(session.messages);
      setCurrentSessionId(session.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updated = savedSessions.filter(s => s.id !== id);
      setSavedSessions(updated);
      localStorage.setItem('prisma_chat_history', JSON.stringify(updated));
      if (currentSessionId === id) handleNewChat();
  };

  const startEditing = (e: React.MouseEvent, session: SavedSession) => { e.stopPropagation(); setEditingSessionId(session.id); setEditingTitle(session.title); };
  const saveTitle = (e: React.MouseEvent | React.KeyboardEvent, id: string) => { e.stopPropagation(); if (!editingTitle.trim()) return; const updated = savedSessions.map(s => s.id === id ? { ...s, title: editingTitle } : s); setSavedSessions(updated); localStorage.setItem('prisma_chat_history', JSON.stringify(updated)); setEditingSessionId(null); };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleFeatureNotReady = (feature: string) => { alert(`Funcionalidade: ${feature} está ativa (Demo).`); };
  const toggleMic = () => { setMicActive(!micActive); if (!micActive) { setTimeout(() => setMicActive(false), 2000); } };

  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; } }, [inputValue]);

  const DashboardCard = ({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void }) => (
      <div onClick={onClick} className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:border-neon-primary/50 hover:bg-white/10 hover:shadow-neon transition-all cursor-pointer flex flex-col gap-3 group h-full duration-300">
          <div className="text-neon-primary group-hover:scale-110 transition-transform duration-300 w-fit drop-shadow-lg">{icon}</div>
          <div><h3 className="text-white font-bold text-sm mb-1">{title}</h3><p className="text-xs text-white/60">{desc}</p></div>
      </div>
  );

  const renderMessageContent = (text: string) => {
      const browserMatch = text.match(/:::BROWSER::(.*):::/);
      if (browserMatch && browserMatch[1]) {
          const url = browserMatch[1];
          const cleanText = text.replace(/:::BROWSER::.*:::/, '').trim();
          return (
              <div className="w-full">
                  <div className="mb-2 prose prose-invert prose-sm max-w-none prose-p:text-white/90"><ReactMarkdown>{cleanText}</ReactMarkdown></div>
                  <BrowserFrame initialUrl={url} onAnalyze={handleBrowserAnalysis} />
              </div>
          );
      }
      return <div className="prose prose-invert prose-sm max-w-none prose-p:text-white/90 prose-a:text-neon-primary"><ReactMarkdown>{text}</ReactMarkdown></div>;
  };

  return (
    <div className="flex h-full font-sans overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-[280px] bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0 z-20 transition-all duration-300">
            <div className="p-5 flex items-center gap-3 mb-2">
                <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-neon-primary to-neon-secondary rounded-lg shadow-neon"><PrismaLogoSmall /></div>
                <div><h1 className="text-md font-bold text-white tracking-wide font-logo">Prisma IA</h1><p className="text-[10px] text-neon-primary tracking-widest uppercase">SEU MUNDO AQUI</p></div>
            </div>
            <div className="px-4 mb-6"><button onClick={handleNewChat} className="w-full flex items-center gap-2 bg-gradient-to-r from-neon-primary to-neon-secondary hover:brightness-110 text-white py-3 px-4 rounded-full font-bold text-sm transition-all shadow-neon"><PlusIcon /> Nova conversa</button></div>
            <div className="flex-1 overflow-y-auto px-4 space-y-4 custom-scrollbar">
                <div>
                    <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 pl-2">Memória Recente</h3>
                    <div className="space-y-1">
                        {savedSessions.length === 0 && (<p className="text-xs text-white/30 italic pl-2">Nenhuma memória salva.</p>)}
                        {savedSessions.map((session) => (
                            <div key={session.id} onClick={() => loadSession(session)} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent ${currentSessionId === session.id ? 'bg-white/10 border-white/10 text-white shadow-lg' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    <div className={`shrink-0 ${currentSessionId === session.id ? 'text-neon-primary' : 'text-white/40'}`}><ChatIcon /></div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        {editingSessionId === session.id ? (
                                            <input value={editingTitle} onChange={e => setEditingTitle(e.target.value)} onClick={e => e.stopPropagation()} onKeyDown={e => { if(e.key==='Enter') saveTitle(e, session.id) }} className="bg-transparent border-b border-neon-primary outline-none text-xs w-full text-white" autoFocus />
                                        ) : (<span className="text-sm truncate font-medium">{session.title}</span>)}
                                        <span className="text-[10px] text-white/40 truncate block opacity-70">{session.preview || "Sem resumo"}</span>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1 ml-2 ${editingSessionId === session.id ? 'flex' : 'hidden group-hover:flex'}`}>
                                    {editingSessionId === session.id ? (<button onClick={e => saveTitle(e, session.id)} className="text-green-400 hover:text-green-300 p-1"><CheckIcon /></button>) : (<button onClick={e => startEditing(e, session)} className="p-1 hover:text-white hover:bg-white/10 rounded"><EditIcon /></button>)}
                                    <button onClick={e => deleteSession(e, session.id)} className="p-1 hover:text-red-400 hover:bg-red-500/10 rounded"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-black/20"><button onClick={() => { if(confirm('Apagar todo o histórico?')) { setSavedSessions([]); localStorage.removeItem('prisma_chat_history'); handleNewChat(); }}} className="flex items-center gap-2 text-white/50 hover:text-red-400 text-sm w-full p-2 rounded-lg hover:bg-red-500/10 transition-colors"><TrashIcon /> Limpar histórico</button></div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col relative bg-transparent z-10">
            <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-2 bg-black/30 p-1 rounded-full border border-white/5 overflow-x-auto">
                    <button onClick={() => setChatMode('flash')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${chatMode === 'flash' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><span className="flex items-center gap-1"><LightningIcon /> Prisma Flash</span></button>
                    <button onClick={() => setChatMode('reasoning')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${chatMode === 'reasoning' ? 'bg-neon-secondary text-white shadow-neon' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><span className="flex items-center gap-1"><span className="text-lg leading-none">🧠</span> Raciocínio (Prisma)</span></button>
                    <button onClick={() => setChatMode('search')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${chatMode === 'search' ? 'bg-neon-primary text-white shadow-neon' : 'text-white/60 hover:text-white hover:bg-white/10'}`}><span className="flex items-center gap-1"><GlobeIcon /> Web</span></button>
                    
                    <button 
                        onClick={() => setIsTradingMode(!isTradingMode)} 
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${isTradingMode ? 'bg-neon-primary text-white animate-pulse shadow-neon' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${isTradingMode ? 'bg-white' : 'bg-neon-primary'}`}></div>
                        {isTradingMode ? 'PRISMA BOT AO VIVO' : 'Prisma Ia Bot'}
                    </button>
                </div>
                <div className="flex items-center gap-3 text-white/70">
                    <button onClick={() => handleFeatureNotReady('Magic Enhance')} className="p-2 hover:text-white hover:bg-white/10 rounded-full transition"><MagicIcon /></button>
                    <button onClick={() => handleFeatureNotReady('Settings')} className="p-2 hover:text-white hover:bg-white/10 rounded-full transition"><SettingsIcon /></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {/* LIVE TRADING PANEL */}
                {isTradingMode && (
                    <div className="max-w-4xl mx-auto px-4 mt-4 animate-fade-in">
                        <ScreenCaptureControl 
                            onCaptureFrame={handleLiveFrame} 
                            isAnalyzing={isLoading}
                            timeframe={tradingTimeframe}
                            onTimeframeChange={setTradingTimeframe}
                            isPaused={false}
                        />
                    </div>
                )}

                {messages.length === 0 && !isTradingMode && (
                    <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in">
                        <div className="mb-12 text-center"><h2 className="text-4xl font-bold text-neon-primary mb-3 text-shadow-neon tracking-tight">PRISMA IA</h2><p className="text-white/60 text-lg font-light">Seu sistema operacional de Inteligência Artificial.</p></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl w-full">
                            <DashboardCard icon={<LightningIcon />} title="Executar Apps" desc='"Abra o Youtube", "Acesse a Pocket Option"...' onClick={() => setChatMode('flash')} />
                            <DashboardCard icon={<BookIcon />} title="E-book Studio" desc="Crie livros com imagens e áudio" onClick={() => onNavigate?.(ViewType.EBOOK_CREATOR)} />
                            <DashboardCard icon={<PaintIcon />} title="Geração de Imagens" desc="Crie arte digital" onClick={() => onNavigate?.(ViewType.IMAGE_GENERATION)} />
                            <DashboardCard icon={<MusicIcon />} title="Criação de Música" desc="Gere áudio e voz" onClick={() => onNavigate?.(ViewType.AUDIO_ANALYSIS)} />
                            <DashboardCard icon={<VideoIcon />} title="Análise de Vídeo" desc="Visão computacional" onClick={() => onNavigate?.(ViewType.IMAGE_ANALYSIS)} />
                            <DashboardCard icon={<MicIcon />} title="Clonagem de Voz" desc="Converta texto em fala" onClick={() => onNavigate?.(ViewType.AUDIO_ANALYSIS)} />
                        </div>
                    </div>
                )}

                {(messages.length > 0 || isTradingMode) && (
                    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 pb-32">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && (<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-primary to-neon-secondary flex items-center justify-center text-white font-bold shrink-0 mt-1 shadow-neon text-xs">AI</div>)}
                                <div className={`max-w-[80%] rounded-2xl px-6 py-4 text-sm leading-relaxed backdrop-blur-md shadow-lg group relative ${msg.role === 'user' ? 'bg-white/10 border border-white/20 text-white rounded-br-none' : 'bg-black/40 border border-white/5 text-white/90 w-full'}`}>
                                    {msg.attachment && (
                                        <div className="mb-3 rounded-xl overflow-hidden border border-white/10 bg-black/50 max-w-sm">
                                            {msg.attachment.type === 'image' && (<img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} alt="Anexo" className="w-full h-auto" />)}
                                            {(msg.attachment.type !== 'image') && (<div className="p-3 font-mono text-xs text-white/70 bg-black/80">{msg.attachment.name}</div>)}
                                        </div>
                                    )}
                                    {msg.role === 'model' ? renderMessageContent(msg.text) : msg.text}
                                    
                                    {/* Exibição das Fontes (Prisma Style) */}
                                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-white/10">
                                            <p className="text-[10px] text-neon-secondary uppercase font-bold tracking-widest mb-2 flex items-center gap-1"><GlobeIcon /> Fontes Verificadas</p>
                                            <div className="flex flex-wrap gap-2">
                                                {msg.groundingChunks.map((chunk, i) => chunk.web?.uri && (
                                                    <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-black/40 border border-white/10 px-3 py-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 hover:border-neon-primary/50 transition flex items-center gap-1 truncate max-w-[200px]">
                                                        <div className="w-1.5 h-1.5 bg-neon-secondary rounded-full"></div>
                                                        {chunk.web.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {msg.role === 'model' && (<button onClick={() => copyToClipboard(msg.text)} className="absolute -bottom-6 right-0 p-1.5 text-white/30 hover:text-neon-primary transition opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px]" title="Copiar Resposta"><CopyIcon /> Copiar</button>)}
                                </div>
                            </div>
                        ))}
                         {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-lg bg-neon-primary/20 flex items-center justify-center text-neon-primary font-bold shrink-0 mt-1 animate-pulse">AI</div>
                                <div className="flex items-center gap-1 h-8 px-4 bg-white/5 rounded-full border border-white/5">
                                    <div className="w-1.5 h-1.5 bg-neon-primary rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-neon-secondary rounded-full animate-bounce delay-100"></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-200"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-0 right-0 px-4 z-20">
                <div className="max-w-3xl mx-auto">
                    {attachment && (
                        <div className="mb-2 bg-black/80 backdrop-blur-md rounded-xl p-2 border border-neon-primary/50 inline-flex items-center gap-3 animate-fade-in shadow-lg relative">
                             {attachment.type === 'image' ? (<img src={`data:${attachment.mimeType};base64,${attachment.data}`} className="w-10 h-10 rounded object-cover" alt="Preview" />) : (<div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center text-white"><FileIcon /></div>)}
                             <div className="max-w-[200px]"><p className="text-xs text-white truncate">{attachment.name}</p></div>
                             <button onClick={clearAttachment} className="p-1 hover:bg-white/20 rounded-full text-white/70 hover:text-white ml-2"><CloseIcon /></button>
                        </div>
                    )}
                    <div className="bg-black/60 backdrop-blur-xl rounded-[24px] p-2 pl-4 flex items-end gap-2 border border-white/10 focus-within:border-neon-primary/50 focus-within:ring-1 focus-within:ring-neon-primary/50 transition-all shadow-2xl relative">
                        <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition mb-0.5"><PlusIcon /></button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*,audio/*" />
                        <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={isTradingMode ? "O modo Trading está ativo. O bot falará automaticamente..." : "Pergunte algo ou execute um app..."} className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 resize-none max-h-32 py-3.5 custom-scrollbar font-medium" rows={1} />
                        <button onClick={toggleMic} className={`p-2.5 rounded-xl hover:bg-white/10 transition mb-0.5 ${micActive ? 'text-red-500 animate-pulse bg-red-500/10' : 'text-white/50 hover:text-white'}`}><MicIcon /></button>
                        <button onClick={() => handleSend()} disabled={(!inputValue.trim() && !attachment) || isLoading} className={`p-3 rounded-xl mb-0.5 transition-all duration-300 ${(inputValue.trim() || attachment) ? 'bg-gradient-to-r from-neon-primary to-neon-secondary text-white shadow-neon hover:scale-105 active:scale-95' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}><SendIcon /></button>
                    </div>
                </div>
            </div>
        </main>
    </div>
  );
};