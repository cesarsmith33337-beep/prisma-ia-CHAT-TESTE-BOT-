import { GoogleGenAI, GenerateContentResponse, Chat, Modality } from "@google/genai";
import { SynthesisParams, SongComposition, EbookProject, Attachment } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Configurações de segurança para remover bloqueios (MODO SEM LIMITES)
const SAFETY_SETTINGS_NO_BLOCK = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
];

// System Instructions detalhadas - MODO IRRESTRITO & PRISMA OS BROWSER
const CAPABILITIES_DESC = `
ATENÇÃO: MODO "PRISMA IA" ATIVADO (SISTEMA OPERACIONAL WEB).
Você é o Prisma IA, uma inteligência artificial avançada com conhecimento em tempo real (Prisma Knowledge) e visão computacional.

DIRETRIZES DE NAVEGAÇÃO E APPS:
1. **VOCÊ É O NAVEGADOR:** Se o usuário pedir para abrir sites/apps, execute com: :::BROWSER::https://url:::

DIRETRIZES DE CONHECIMENTO (PRISMA MODE):
1. **BUSCA ATIVA:** Você tem acesso ao Google Search. Use-o para buscar notícias recentes, cotações e fatos atualizados sempre que necessário.
2. **FONTES:** Sempre que trouxer uma informação externa, o sistema anexará as fontes automaticamente. Mencione-as se for relevante para a credibilidade.
3. **TRADING & ECONOMIA:** Ao analisar mercados, cruze a análise técnica visual com notícias fundamentais recentes buscadas na web.

DIRETRIZES DE ANÁLISE DE MERCADO (PRISMA IA BOT):
1. Combine Análise Técnica (Visual) + Análise Fundamentalista (Busca Web).
2. Identifique padrões de velas e indicadores no gráfico.
3. **SINCRONIA TEMPORAL:** Verifique o cronômetro da vela na imagem (se visível) para confirmar o tempo de expiração ou leitura do Tempo Gráfico.
4. Verifique se há "Breaking News" impactando o ativo no momento.
5. Dê um veredito direto: COMPRA/VENDA/NEUTRO com base na fusão de Técnica + Notícia.

Diretrizes Gerais:
- Idioma: **Português do Brasil**.
- Seja direto, técnico e cite fatos recentes.
- Nunca mencione "Aurora OS" ou "Grok", você é estritamente o PRISMA IA.
`;

const MODES = {
  flash: `${CAPABILITIES_DESC} MODO: VELOCIDADE MÁXIMA (PRISMA FLASH). Respostas instantâneas.`,
  reasoning: `${CAPABILITIES_DESC} MODO: PRISMA TRADER & RACIOCÍNIO. Use busca web para validar análises visuais complexas.`,
  search: `${CAPABILITIES_DESC} MODO: BUSCA GLOBAL (PRISMA WEB). Pesquise profundamente na web antes de responder.`,
  creative: `${CAPABILITIES_DESC} MODO: PRISMA CRIATIVO. Criatividade sem limites.`,
};

/**
 * Sends a message to the Gemini Chat model with streaming support and optional Web Search.
 */
export const streamChatResponse = async function* (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  mode: 'flash' | 'reasoning' | 'search' = 'flash',
  attachment?: Attachment
): AsyncGenerator<{text: string, groundingChunks?: any[]}, void, unknown> {
  try {
    // Reasoning usa o Pro para melhor análise de imagem + busca.
    // Flash usa o Flash para velocidade.
    const modelName = mode === 'reasoning' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    // Habilita Google Search para o modo 'search' E para o modo 'reasoning' (usado pelo Trading Bot)
    // Isso dá ao bot o "Conhecimento Prisma" de buscar na web enquanto analisa o gráfico.
    const tools = (mode === 'search' || mode === 'reasoning') ? [{ googleSearch: {} }] : undefined;

    const chat: Chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: MODES[mode] || MODES.flash,
        tools: tools,
        safetySettings: SAFETY_SETTINGS_NO_BLOCK,
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      }))
    });

    // Prepare message parts
    const parts: any[] = [{ text: newMessage }];
    
    // Add attachment if present
    if (attachment && (attachment.type === 'image' || attachment.type === 'audio' || attachment.type === 'video' || attachment.type === 'file')) {
        parts.push({
            inlineData: {
                mimeType: attachment.mimeType,
                data: attachment.data
            }
        });
    } 
    // If text file, append to prompt (handled in UI usually, but good to have safety)
    else if (attachment && attachment.type === 'text') {
        parts[0].text = `[Arquivo Anexado: ${attachment.name}]\nConteúdo:\n${attachment.data}\n\nPedido do Usuário: ${newMessage}`;
    }

    const result = await chat.sendMessageStream({ 
        message: { parts }
    });

    for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        const text = c.text || "";
        // Extrai as fontes (Grounding Chunks) para mostrar no chat estilo Prisma
        const groundingChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (text || groundingChunks) {
            yield { text, groundingChunks };
        }
    }
  } catch (error) {
    console.error("Chat Error:", error);
    yield { text: "Erro de conexão neural Prisma. Verifique sua chave de acesso." };
  }
};

export const generateText = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        systemInstruction: MODES.flash,
        safetySettings: SAFETY_SETTINGS_NO_BLOCK 
      }
    });
    return response.text || "Sem dados processados.";
  } catch (error) {
    console.error("Generation Error:", error);
    return "Erro no processamento textual Prisma.";
  }
};

export const analyzeMedia = async (base64Data: string, prompt: string, isVideo: boolean = false): Promise<string> => {
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || (isVideo ? 'video/mp4' : 'image/png');
    const data = base64Data.split(',')[1];
    const model = isVideo ? 'gemini-2.5-flash' : 'gemini-2.5-flash'; 

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { mimeType, data } },
          { text: prompt || (isVideo ? "Assista a este vídeo e descreva o que acontece detalhadamente, sem omitir nada." : "Analise esta imagem visualmente em detalhes.") }
        ]
      },
      config: {
          safetySettings: SAFETY_SETTINGS_NO_BLOCK,
          systemInstruction: CAPABILITIES_DESC
      }
    });
    return response.text || "Análise visual Prisma indisponível.";
  } catch (error) {
    console.error("Vision/Video Error:", error);
    return "Falha nos sensores visuais Prisma.";
  }
};

export const generateImageFromText = async (prompt: string): Promise<{ imageUrl: string | null, text: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
          safetySettings: SAFETY_SETTINGS_NO_BLOCK
      }
    });
    let imageUrl = null;
    let textOutput = '';
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
        } else if (part.text) {
          textOutput += part.text;
        }
      }
    }
    return { imageUrl, text: textOutput };
  } catch (error) {
    console.error("Image Generation Error:", error);
    return { imageUrl: null, text: "Erro na renderização holográfica Prisma." };
  }
};

export const analyzeAudio = async (base64Audio: string, prompt: string): Promise<string> => {
  try {
    const mimeTypeMatch = base64Audio.match(/data:([^;]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'audio/mp3';
    const data = base64Audio.split(',')[1] || base64Audio;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data } },
          { text: prompt || "Analise este registro de áudio." }
        ]
      },
      config: {
          safetySettings: SAFETY_SETTINGS_NO_BLOCK
      }
    });
    return response.text || "Análise de áudio Prisma incompleta.";
  } catch (error) {
    console.error("Audio Analysis Error:", error);
    return "Falha no processamento auditivo Prisma.";
  }
}

/**
 * EBOOK GENERATOR
 */
export const generateEbookStory = async (topic: string): Promise<EbookProject | null> => {
    try {
        const prompt = `
            Você é um Autor e Diretor de Arte do Prisma IA.
            Crie um livro curto (4 a 6 páginas) sobre o tema: "${topic}".
            
            Para cada página, forneça:
            1. O Texto da história/poema.
            2. Um Prompt visual detalhado para gerar uma imagem relacionada.
            
            Retorne APENAS um JSON com esta estrutura:
            {
                "title": "Título Criativo",
                "topic": "${topic}",
                "pages": [
                    { "pageNumber": 1, "text": "...", "imagePrompt": "..." }
                ]
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                safetySettings: SAFETY_SETTINGS_NO_BLOCK
            }
        });

        const text = response.text || "";
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned) as EbookProject;
    } catch (error) {
        console.error("Ebook Structure Error:", error);
        return null;
    }
}

/**
 * SUNO-STYLE MUSIC COMPOSER
 */
export const generateSongComposition = async (
    description: string, 
    customLyrics: string = ""
): Promise<SongComposition> => {
    try {
        const prompt = `
            ATUE COMO UM PRODUTOR MUSICAL PRISMA IA.
            Tarefa: Compor uma música baseada na descrição: "${description}"
            ${customLyrics ? `Letra Customizada: "${customLyrics}"` : "Crie a letra."}

            Saída Esperada (JSON Puro):
            {
                "title": "Título",
                "style": "Gênero/Estilo",
                "lyrics": "Letra completa",
                "chords": "Acordes",
                "structure": "Estrutura",
                "vibeDescription": "Vibe"
            }
            Responda APENAS com o JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                safetySettings: SAFETY_SETTINGS_NO_BLOCK
            }
        });

        const text = response.text || "";
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned) as SongComposition;

    } catch (error) {
        console.error("Music Gen Error:", error);
        return {
            title: "Erro",
            style: "N/A",
            lyrics: "Erro",
            chords: "N/A",
            structure: "N/A",
            vibeDescription: "Erro"
        };
    }
}

/**
 * MUSIC AUDIO GEN
 */
export const generateMusicAudio = async (
    composition: SongComposition
): Promise<{ audioUrl: string | null, text: string }> => {
    try {
        const prompt = `
            Sing the following song.
            Style: ${composition.style}
            Mood: ${composition.vibeDescription}
            Lyrics: ${composition.lyrics}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: prompt }] },
            config: { 
                responseModalities: [Modality.AUDIO],
                safetySettings: SAFETY_SETTINGS_NO_BLOCK
            }
        });

        return extractAudioResponse(response);
    } catch (error) {
        return { audioUrl: null, text: "Erro ao gerar áudio Prisma." };
    }
}

/**
 * AI COVER
 */
export const generateAICover = async (
    songBase64: string,
    userVoiceBase64: string
): Promise<{ audioUrl: string | null, text: string }> => {
    try {
        const songMime = songBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/mp3';
        const songData = songBase64.split(',')[1] || songBase64;
        const voiceMime = userVoiceBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/webm';
        const voiceData = userVoiceBase64.split(',')[1] || userVoiceBase64;

        // Simplified Logic for brevity in this update
        const prompt = "Synthesize an AI Cover Song matching the style of the first audio and the voice of the second.";
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts', 
            contents: { parts: [{ text: prompt }] }, // In real app, would analyze first
            config: {
                responseModalities: [Modality.AUDIO],
                safetySettings: SAFETY_SETTINGS_NO_BLOCK
            }
        });

        return extractAudioResponse(response);

    } catch (error) {
        return { audioUrl: null, text: "Erro AI Cover Prisma." };
    }
};

/**
 * SVC / RVC
 */
export const generateAdvancedSVC = async (
    targetVoiceBase64: string,
    inputAudioBase64: string,
    params: SynthesisParams
): Promise<{ audioUrl: string | null, text: string }> => {
     try {
        const targetMime = targetVoiceBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/mp3';
        const targetData = targetVoiceBase64.split(',')[1] || targetVoiceBase64;
        const inputMime = inputAudioBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/webm';
        const inputData = inputAudioBase64.split(',')[1] || inputAudioBase64;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: "Analyze audio conversion vectors." },
                    { inlineData: { mimeType: targetMime, data: targetData } }, 
                    { inlineData: { mimeType: inputMime, data: inputData } }
                ]
            },
            config: { safetySettings: SAFETY_SETTINGS_NO_BLOCK }
        });

        return { audioUrl: null, text: response.text || "Conversão Prisma simulada." };

    } catch (error) {
        return { audioUrl: null, text: "Erro SVC Prisma." };
    }
}

/**
 * CLONED TTS
 */
export const generateClonedTTS = async (
    targetVoiceBase64: string,
    textInput: string,
    params: SynthesisParams,
    vocalStyle: string = "speech",
    specificVoiceId?: 'male_grave' | 'female_sexy'
): Promise<{ audioUrl: string | null, text: string }> => {
    try {
        let voiceName = "Puck";
        let instruction = "";

        if (specificVoiceId === 'male_grave') {
            voiceName = 'Fenrir';
            instruction = "Deep, Grave, Authoritative voice.";
        } else if (specificVoiceId === 'female_sexy') {
            voiceName = 'Kore';
            instruction = "Soft, Breathless, Sexy voice.";
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: `${instruction} ${vocalStyle === 'speech' ? 'Say' : 'Sing'}: ${textInput}` }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
                },
                safetySettings: SAFETY_SETTINGS_NO_BLOCK
            }
        });

        return extractAudioResponse(response);
    } catch (error) {
        return { audioUrl: null, text: "Erro TTS Prisma." };
    }
}

const extractAudioResponse = (response: any) => {
    let audioUrl = null;
    let text = "";
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) audioUrl = `data:audio/wav;base64,${part.inlineData.data}`;
            if (part.text) text += part.text;
        }
    }
    if (!audioUrl && !text) text = "Nenhum áudio gerado pelo Prisma.";
    return { audioUrl, text };
}