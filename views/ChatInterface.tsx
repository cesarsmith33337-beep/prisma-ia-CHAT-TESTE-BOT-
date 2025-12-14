import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, ClearIcon, SaveIcon, HistoryIcon, TrashIcon, CloseIcon, WindIcon, LightningIcon, PaletteIcon, EditIcon, CheckIcon } from '../components/Icons';
import { streamChatResponse } from '../services/gemini';
import { Message, SavedSession, GroundingChunk } from '../types';
import ReactMarkdown from 'react-markdown';

type ChatMode = 'flash' | 'reasoning' | 'search';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá. Sou a Prisma IA. Escolha um modo abaixo e comece.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('flash');
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // States for Editing
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('prisma_chat_history');
    if (stored) {
        try { setSavedSessions(JSON.parse(stored)); } catch (e) { console.error("Failed to load history"); }
    }
    setTimeout(scrollToBottom, 100);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      let fullText = '';
      let allGroundingChunks: GroundingChunk[] = [];

      const stream = streamChatResponse(history, userMsg.text, chatMode);

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
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Erro de conexão.', isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- SAVE/LOAD HISTORY LOGIC ---
  const handleSaveSession = () => {
     if (messages.length <= 1) return;
     
     // Generate Title: First user message or generic
     const firstUserMsg = messages.find(m => m.role === 'user');
     const title = firstUserMsg ? firstUserMsg.text.slice(0, 40) + (firstUserMsg.text.length > 40 ? '...' : '') : 'Nova Conversa';
     
     // Generate Preview (Last Message)
     const lastMsg = messages[messages.length - 1];
     const preview = lastMsg.text.slice(0, 60) + '...';

     // Generate Summary (Detailed Context)
     // Use first user message + start of model response for context
     const firstModelMsg = messages.find(m => m.role === 'model' && m.text.length > 20);
     const summaryContext = firstModelMsg 
        ? `${firstUserMsg?.text.slice(0,50)}... -> ${firstModelMsg.text.slice(0, 100)}` 
        : lastMsg.text.slice(0, 150);

     const newSession: SavedSession = {
         id: currentSessionId || Date.now().toString(),
         title: title, 
         summary: summaryContext,
         date: new Date().toISOString(), 
         preview: preview, 
         messages: [...messages]
     };

     let updatedSessions;
     if (currentSessionId) {
         updatedSessions = savedSessions.map(s => s.id === currentSessionId ? newSession : s);
     } else {
         updatedSessions = [newSession, ...savedSessions];
         setCurrentSessionId(newSession.id);
     }
     setSavedSessions(updatedSessions);
     localStorage.setItem('prisma_chat_history', JSON.stringify(updatedSessions));
     setShowHistory(true);
  };

  const loadSession = (session: SavedSession) => {
      setMessages(session.messages);
      setCurrentSessionId(session.id);
      setShowHistory(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updated = savedSessions.filter(s => s.id !== id);
      setSavedSessions(updated);
      localStorage.setItem('prisma_chat_history', JSON.stringify(updated));
      if (currentSessionId === id) handleNewChat();
  };

  // --- EDITING LOGIC ---
  const startEditing = (e: React.MouseEvent, session: SavedSession) => {
      e.stopPropagation();
      setEditingSessionId(session.id);
      setEditingTitle(session.title);
  };

  const saveTitle = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
      e.stopPropagation();
      if (!editingTitle.trim()) return;

      const updated = savedSessions.map(s => s.id === id ? { ...s, title: editingTitle } : s);
      setSavedSessions(updated);
      localStorage.setItem('prisma_chat_history', JSON.stringify(updated));
      setEditingSessionId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
      if (e.key === 'Enter') {
          saveTitle(e, id);
      }
      if (e.key === 'Escape') {
          setEditingSessionId(null);
      }
  };

  const handleNewChat = () => {
      setMessages([{ role: 'model', text: 'Olá. Sou a Prisma IA. Escolha um modo abaixo e comece.' }]);
      setCurrentSessionId(null);
      setInputValue('');
  };

  const formatDate = (isoString: string) => {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className="flex flex-col h-[85vh] bg-studio-card/80 backdrop-blur-xl rounded-3xl shadow-neon border border-studio-border overflow-hidden relative transition-all duration-500 hover:shadow-neon-strong group/chatbox">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-studio-border flex justify-between items-center bg-black/60 z-20 backdrop-blur-xl relative">
        <div className="flex items-center gap-3">
            <div className="relative">
                <span className="absolute inset-0 bg-neon-primary rounded-full animate-ping opacity-75"></span>
                <span className="relative block w-2 h-2 bg-neon-primary rounded-full shadow-[0_0_8px_var(--neon-primary)]"></span>
            </div>
            <span className="font-mono font-semibold text-white tracking-widest text-xs uppercase text-shadow-sm flex flex-col">
                <span>{currentSessionId ? 'Memória Resgatada' : 'Sessão Ativa'}</span>
                <span className="text-[9px] text-studio-muted leading-none mt-0.5">
                    Mode: {chatMode === 'search' ? 'WEB HUNTER (Grok)' : chatMode === 'reasoning' ? 'DEEP REASON (o1)' : 'PRISMA FLASH'}
                </span>
            </span>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowHistory(!showHistory)} className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-300 ${showHistory ? 'bg-neon-primary text-white border-neon-primary shadow-neon' : 'text-studio-muted border-white/10 hover:text-white hover:border-neon-primary/50'}`}>
                <HistoryIcon /> <span className="hidden sm:inline">Memória</span>
            </button>
            <button onClick={handleSaveSession} className="text-xs font-bold text-studio-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-neon-secondary/50 hover:bg-neon-secondary/10 transition-all duration-300">
                <SaveIcon /> <span className="hidden sm:inline">Salvar</span>
            </button>
            <button onClick={handleNewChat} className="text-xs font-bold text-studio-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-neon-primary/50 hover:bg-neon-primary/10 transition-all duration-300">
                <ClearIcon /> <span className="hidden sm:inline">Novo</span>
            </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative overflow-hidden flex bg-black/20">
          <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32 space-y-6 custom-scrollbar scroll-smooth">
            {messages.map((msg, idx) => (
            <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[75%]`}>
                    <div 
                    className={`px-6 py-4 rounded-2xl text-sm leading-relaxed backdrop-blur-md shadow-lg transition-all duration-300 ${
                        msg.role === 'user' 
                        ? 'bg-[#0f0f0f] border border-neon-primary/40 text-white font-medium rounded-br-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-neon-border' 
                        : 'bg-studio-panel/80 text-studio-text border border-white/5 rounded-bl-sm hover:border-white/10'
                    }`}
                    >
                    {msg.role === 'model' ? (
                        <div className="prose prose-sm prose-invert prose-p:text-gray-300 prose-headings:text-white prose-a:text-neon-primary prose-code:text-neon-secondary prose-code:bg-black/50 prose-code:px-1 prose-code:rounded max-w-none font-sans">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                    ) : (
                        msg.text
                    )}
                    </div>
                    {/* Sources / Grounding Display */}
                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="flex flex-wrap gap-2 ml-1">
                            {msg.groundingChunks.map((chunk, i) => chunk.web?.uri && (
                                <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-black/50 border border-white/10 px-2 py-1 rounded hover:bg-neon-secondary/20 hover:border-neon-secondary hover:text-white text-studio-muted transition-colors flex items-center gap-1">
                                    <WindIcon /> {chunk.web.title || "Fonte Web"}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            ))}
            
            {/* Typing Indicator */}
            {isLoading && messages[messages.length - 1]?.text === '' && (
            <div className="flex justify-start w-full animate-fade-in pl-1">
                <div className="flex items-center gap-4 px-5 py-3 bg-studio-panel border border-neon-primary/40 shadow-[0_0_20px_rgba(217,70,239,0.15)] rounded-2xl rounded-bl-none backdrop-blur-md">
                    <div className="flex gap-1.5 items-center">
                        <div className="w-2 h-2 bg-neon-primary rounded-full animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_10px_#D946EF]"></div>
                        <div className="w-2 h-2 bg-white rounded-full animate-[pulse_1.5s_ease-in-out_infinite_200ms] shadow-[0_0_10px_#FFFFFF]"></div>
                        <div className="w-2 h-2 bg-neon-secondary rounded-full animate-[pulse_1.5s_ease-in-out_infinite_400ms] shadow-[0_0_10px_#8B5CF6]"></div>
                    </div>
                    <span className="text-xs font-mono text-neon-primary font-bold uppercase tracking-[0.2em] animate-pulse drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]">
                    {chatMode === 'search' ? 'Pesquisando...' : chatMode === 'reasoning' ? 'Raciocinando...' : 'Digitando...'}
                    </span>
                </div>
            </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* History Sidebar */}
          <div className={`absolute inset-y-0 right-0 w-80 bg-[#050505] border-l border-studio-border transform transition-transform duration-300 z-30 shadow-2xl ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-4 border-b border-studio-border flex justify-between items-center bg-black/40">
                  <span className="text-xs font-bold text-neon-secondary uppercase tracking-widest flex items-center gap-2">
                      <HistoryIcon /> Memória Neural
                  </span>
                  <button onClick={() => setShowHistory(false)} className="text-studio-muted hover:text-white transition">
                      <CloseIcon />
                  </button>
              </div>
              <div className="overflow-y-auto h-full pb-20 p-2 custom-scrollbar">
                  {savedSessions.length === 0 ? (
                      <div className="text-center text-studio-muted text-xs p-8 opacity-50 italic">Nenhuma memória salva.</div>
                  ) : (
                      <div className="space-y-2">
                          {savedSessions.map((session) => (
                              <div key={session.id} onClick={() => loadSession(session)} className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group relative ${currentSessionId === session.id ? 'bg-neon-primary/10 border-neon-primary/50' : 'bg-studio-panel border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
                                  
                                  {/* Header: Date + Actions */}
                                  <div className="flex justify-between items-center mb-1.5 opacity-60">
                                      <span className="text-[9px] font-mono text-studio-muted">{formatDate(session.date)}</span>
                                      <div className="flex gap-1">
                                          {editingSessionId !== session.id && (
                                              <button onClick={(e) => startEditing(e, session)} className="text-studio-muted hover:text-white transition p-1 hover:bg-white/10 rounded" title="Editar Título">
                                                  <EditIcon />
                                              </button>
                                          )}
                                          <button onClick={(e) => deleteSession(e, session.id)} className="text-studio-muted hover:text-red-500 transition p-1 hover:bg-red-500/10 rounded" title="Apagar">
                                              <TrashIcon />
                                          </button>
                                      </div>
                                  </div>

                                  {/* Title (Editable) */}
                                  {editingSessionId === session.id ? (
                                      <div className="flex items-center gap-1 mb-2 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                          <input 
                                              type="text" 
                                              value={editingTitle} 
                                              onChange={(e) => setEditingTitle(e.target.value)}
                                              onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                                              autoFocus
                                              className="w-full bg-black border border-neon-primary rounded px-2 py-1 text-xs text-white outline-none"
                                          />
                                          <button onClick={(e) => saveTitle(e, session.id)} className="text-green-500 hover:text-green-400 p-1"><CheckIcon /></button>
                                      </div>
                                  ) : (
                                      <h4 className="text-sm font-bold text-white mb-1.5 line-clamp-1">{session.title}</h4>
                                  )}

                                  {/* Summary / Preview */}
                                  <div className="text-[10px] text-studio-muted border-t border-white/5 pt-2 mt-1">
                                      <p className="line-clamp-3 leading-relaxed">
                                        {session.summary || session.preview}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Input Area with Model Selector */}
      <div className="p-4 bg-studio-card/80 border-t border-studio-border backdrop-blur-md z-20 flex flex-col gap-2">
        {/* Model Selector Pills */}
        <div className="flex justify-center gap-2 mb-1">
            <button 
                onClick={() => setChatMode('flash')}
                className={`text-[10px] px-3 py-1 rounded-full border uppercase tracking-wider font-bold transition-all ${chatMode === 'flash' ? 'bg-white text-black border-white' : 'bg-transparent text-studio-muted border-white/10 hover:border-white/30'}`}
            >
                ⚡ Prisma Flash
            </button>
            <button 
                onClick={() => setChatMode('reasoning')}
                className={`text-[10px] px-3 py-1 rounded-full border uppercase tracking-wider font-bold transition-all ${chatMode === 'reasoning' ? 'bg-neon-secondary text-white border-neon-secondary shadow-neon' : 'bg-transparent text-studio-muted border-white/10 hover:border-neon-secondary/50'}`}
            >
                🧠 Deep Reason
            </button>
            <button 
                onClick={() => setChatMode('search')}
                className={`text-[10px] px-3 py-1 rounded-full border uppercase tracking-wider font-bold transition-all ${chatMode === 'search' ? 'bg-neon-primary text-white border-neon-primary shadow-neon' : 'bg-transparent text-studio-muted border-white/10 hover:border-neon-primary/50'}`}
            >
                🌐 Web Hunter
            </button>
        </div>

        <div className="max-w-4xl mx-auto w-full relative flex items-end gap-2 bg-[#050505] border border-white/10 rounded-[24px] px-2 py-2 focus-within:ring-1 focus-within:ring-neon-primary/50 focus-within:shadow-[0_0_20px_rgba(217,70,239,0.2)] focus-within:border-neon-primary/50 transition-all duration-300">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Digite seu comando para ${chatMode === 'search' ? 'pesquisar na web...' : 'o modelo...'}`}
            className="w-full max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 outline-none text-white placeholder-studio-muted resize-none py-2.5 px-4 text-sm font-medium custom-scrollbar"
            rows={1}
            style={{ height: 'auto' }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className={`p-2.5 rounded-full mb-0.5 transition-all duration-300 group ${
              isLoading || !inputValue.trim()
                ? 'bg-transparent text-studio-border'
                : 'bg-white text-black hover:bg-neon-primary hover:text-white hover:shadow-neon hover:scale-105 active:scale-95'
            }`}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};