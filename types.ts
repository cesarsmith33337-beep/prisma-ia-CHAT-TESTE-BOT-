import React from 'react';

export enum ViewType {
  CHAT = 'CHAT',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  IMAGE_GENERATION = 'IMAGE_GENERATION',
  AUDIO_ANALYSIS = 'AUDIO_ANALYSIS',
  TEXT_SUMMARY = 'TEXT_SUMMARY',
  EBOOK_CREATOR = 'EBOOK_CREATOR'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'text' | 'file'; // Adicionado 'file' para ZIPs/PDFs
  data: string; // Base64 ou texto puro
  mimeType: string;
  name: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  attachment?: Attachment; // Novo campo para anexo
  isError?: boolean;
  groundingChunks?: GroundingChunk[];
}

export interface ChatSession {
  id: string;
  messages: Message[];
}

export interface SavedSession {
  id: string;
  title: string;
  summary?: string; 
  date: string; 
  preview: string;
  messages: Message[];
}

export interface DemoConfig {
  id: ViewType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface VoiceModel {
  id: string;
  name: string;
  sourceAudio: string; 
  dateCreated: string;
  epochs: number; 
  genre?: string; 
}

export interface SynthesisParams {
  pitch: number;      
  breathiness: number;
  reverb: number;     
  similarity: number; 
  speed: number;      
}

export interface SongComposition {
    title: string;
    style: string;
    lyrics: string;
    chords: string; 
    structure: string; 
    vibeDescription: string;
}

export interface EbookPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
}

export interface EbookProject {
  title: string;
  topic: string;
  pages: EbookPage[];
}

export interface ScreenCaptureHandle {
  captureFrame: () => string | null;
}