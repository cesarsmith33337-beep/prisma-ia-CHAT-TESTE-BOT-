import React from 'react';

export enum ViewType {
  CHAT = 'CHAT',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  IMAGE_GENERATION = 'IMAGE_GENERATION',
  AUDIO_ANALYSIS = 'AUDIO_ANALYSIS',
  TEXT_SUMMARY = 'TEXT_SUMMARY'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string;
  isError?: boolean;
  groundingChunks?: GroundingChunk[]; // Suporte a fontes da web
}

export interface ChatSession {
  id: string;
  messages: Message[];
}

export interface SavedSession {
  id: string;
  title: string;
  summary?: string; // Novo campo para resumo detalhado
  date: string; // ISO String
  preview: string;
  messages: Message[];
}

export interface DemoConfig {
  id: ViewType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// Novos tipos para o Estúdio de Voz (SVC)
export interface VoiceModel {
  id: string;
  name: string;
  sourceAudio: string; // Base64 do áudio de treino
  dateCreated: string;
  epochs: number; // Simulado para UX
}

export interface SynthesisParams {
  pitch: number;      // -12 a +12 semitons
  breathiness: number; // 0 a 100
  reverb: number;     // 0 a 100
  similarity: number; // 0 a 100
}