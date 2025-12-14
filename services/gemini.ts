import { GoogleGenAI, GenerateContentResponse, Chat, Modality } from "@google/genai";
import { SynthesisParams } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System Instructions para diferentes personas
const BASE_INSTRUCTION = "Você é a Prisma IA. Responda em Português do Brasil.";

const MODES = {
  flash: `${BASE_INSTRUCTION} Seja útil, concisa e rápida.`,
  reasoning: `${BASE_INSTRUCTION} Aja como um modelo de raciocínio profundo (similar ao DeepSeek/o1). Pense passo a passo antes de responder. Analise logicamente, verifique fatos e forneça respostas extremamente detalhadas e técnicas.`,
  search: `${BASE_INSTRUCTION} Aja como um pesquisador avançado (similar ao Grok). Use a ferramenta de busca para encontrar informações atualizadas, notícias recentes e fatos obscuros. Seja direto, baseado em fatos e cite suas fontes.`
};

/**
 * Sends a message to the Gemini Chat model with streaming support and optional Web Search.
 */
export const streamChatResponse = async function* (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  mode: 'flash' | 'reasoning' | 'search' = 'flash'
): AsyncGenerator<{text: string, groundingChunks?: any[]}, void, unknown> {
  try {
    // Configuração baseada no modo escolhido
    const modelName = mode === 'reasoning' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    // Ferramentas: Apenas ativa busca se estiver no modo 'search' ou 'reasoning'
    const tools = (mode === 'search') ? [{ googleSearch: {} }] : undefined;

    const chat: Chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: MODES[mode],
        tools: tools,
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      }))
    });

    const result = await chat.sendMessageStream({ message: newMessage });

    for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        
        // Extrair texto e metadados de busca (links)
        const text = c.text || "";
        const groundingChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;

        if (text || groundingChunks) {
            yield { text, groundingChunks };
        }
    }
  } catch (error) {
    console.error("Chat Error:", error);
    yield { text: "Erro de conexão neural. Verifique sua chave de acesso ou tente outro modo." };
  }
};

/**
 * Generates text based on a prompt (non-streaming).
 */
export const generateText = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: MODES.flash,
      }
    });
    return response.text || "Sem dados processados.";
  } catch (error) {
    console.error("Generation Error:", error);
    return "Erro no processamento textual.";
  }
};

/**
 * Analyzes Image OR Video with a text prompt.
 * Now supports 'video/*' mime types.
 */
export const analyzeMedia = async (base64Data: string, prompt: string, isVideo: boolean = false): Promise<string> => {
  try {
    const mimeType = base64Data.split(';')[0].split(':')[1] || (isVideo ? 'video/mp4' : 'image/png');
    const data = base64Data.split(',')[1]; // Remove header

    // Use Pro model for better video/image reasoning
    const model = isVideo ? 'gemini-2.5-flash' : 'gemini-2.5-flash'; 

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data
            }
          },
          {
            text: prompt || (isVideo ? "Assista a este vídeo e descreva o que acontece detalhadamente." : "Analise esta imagem visualmente.")
          }
        ]
      }
    });

    return response.text || "Análise de mídia indisponível.";

  } catch (error) {
    console.error("Vision/Video Error:", error);
    return "Falha nos sensores visuais. O arquivo pode ser muito grande ou formato não suportado.";
  }
};

/**
 * Generates an image from a text prompt using gemini-2.5-flash-image
 */
export const generateImageFromText = async (prompt: string): Promise<{ imageUrl: string | null, text: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
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
    return { imageUrl: null, text: "Erro na renderização holográfica." };
  }
};

/**
 * Analyzes audio with a text prompt using gemini-2.5-flash
 */
export const analyzeAudio = async (base64Audio: string, prompt: string): Promise<string> => {
  try {
    const mimeTypeMatch = base64Audio.match(/data:([^;]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'audio/mp3'; // Default fallback
    const data = base64Audio.split(',')[1] || base64Audio;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data
            }
          },
          {
            text: prompt || "Analise este registro de áudio."
          }
        ]
      }
    });

    return response.text || "Análise de áudio incompleta.";

  } catch (error) {
    console.error("Audio Analysis Error:", error);
    return "Falha no processamento auditivo.";
  }
}

/**
 * Advanced Voice Conversion (SVC - Singing Voice Conversion).
 * Input: Reference Voice + Source Audio Song.
 */
export const generateAdvancedSVC = async (
    targetVoiceBase64: string, // The "Trained" model audio
    inputAudioBase64: string,  // The song/audio to convert
    params: SynthesisParams
): Promise<{ audioUrl: string | null, text: string }> => {
    try {
        const targetMime = targetVoiceBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/mp3';
        const targetData = targetVoiceBase64.split(',')[1] || targetVoiceBase64;

        const inputMime = inputAudioBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/webm';
        const inputData = inputAudioBase64.split(',')[1] || inputAudioBase64;

        const engineeringPrompt = `
            Task: Singing Voice Conversion (SVC).
            
            Input 1 (Reference): This is the TARGET VOICE model. Analyze its timbre, breathiness, and unique vocal characteristics deeply.
            Input 2 (Source): This is the SOURCE SONG/SPEECH.
            
            Action: Re-synthesize the content (lyrics and melody) of Input 2 using the voice of Input 1.
            
            Parameters:
            - Pitch Shift: ${params.pitch > 0 ? '+' : ''}${params.pitch} semitones.
            - Reverb Amount: ${params.reverb}%.
            - Breathiness/Air: ${params.breathiness}%.
            - Timbre Similarity Target: ${params.similarity}%.
            
            Output: A high-quality audio file of the Source sung by the Target Voice. Minimize artifacts.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: engineeringPrompt },
                    { inlineData: { mimeType: targetMime, data: targetData } }, // Input 1
                    { inlineData: { mimeType: inputMime, data: inputData } }     // Input 2
                ]
            },
        });

        return extractAudioResponse(response);

    } catch (error) {
        console.error("SVC Generation Error:", error);
        return { audioUrl: null, text: "Erro no motor de síntese neural (SVC)." };
    }
}

/**
 * Text-to-Speech Voice Cloning (TTS).
 * Input: Reference Voice + Text.
 */
export const generateClonedTTS = async (
    targetVoiceBase64: string,
    textInput: string,
    params: SynthesisParams
): Promise<{ audioUrl: string | null, text: string }> => {
    try {
        const targetMime = targetVoiceBase64.match(/data:([^;]+);base64,/)?.[1] || 'audio/mp3';
        const targetData = targetVoiceBase64.split(',')[1] || targetVoiceBase64;

        const engineeringPrompt = `
            Task: Text-to-Speech (TTS) Voice Cloning.
            
            Input Audio: Reference Voice Sample.
            Input Text: "${textInput}"
            
            Action: Speak (or sing if the text implies lyrics) the Input Text using the exact voice, accent, and timbre of the Input Audio.
            
            Parameters:
            - Emotion/Tone: Natural, expressive.
            - Breathiness: ${params.breathiness}%.
            - Reverb: ${params.reverb}%.
            
            Output: A generated audio file of the text spoken by the cloned voice.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: engineeringPrompt },
                    { inlineData: { mimeType: targetMime, data: targetData } }
                ]
            },
        });

        return extractAudioResponse(response);

    } catch (error) {
        console.error("TTS Generation Error:", error);
        return { audioUrl: null, text: "Erro no motor de síntese neural (TTS)." };
    }
}

// Helper to extract audio from response
const extractAudioResponse = (response: any) => {
    let audioUrl = null;
    let text = "";

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64Audio = part.inlineData.data;
                audioUrl = `data:audio/wav;base64,${base64Audio}`;
            }
            if (part.text) {
                text += part.text;
            }
        }
    }
    return { audioUrl, text };
}