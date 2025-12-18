/**
 * TTS API Server
 * Uses Gemini 2.5 Flash TTS model via Google Generative AI API
 * Optimized for meditation narration with fast response times
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// TTS Model - Pro for highest quality meditation narration
const TTS_MODEL = 'gemini-2.5-pro-preview-tts';

// Request timeout in milliseconds (5 minutes for long narrations with Pro model)
const REQUEST_TIMEOUT_MS = 300000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Gemini client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Converts raw PCM audio (L16) to WAV format
 * Gemini TTS returns: 24kHz, 16-bit, mono PCM audio
 */
function pcmToWav(pcmBase64) {
    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    
    const wavBuffer = Buffer.alloc(headerSize + dataSize);
    
    // RIFF header
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(headerSize + dataSize - 8, 4);
    wavBuffer.write('WAVE', 8);
    
    // fmt chunk
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);           // Subchunk1Size
    wavBuffer.writeUInt16LE(1, 20);            // AudioFormat (PCM)
    wavBuffer.writeUInt16LE(numChannels, 22);  // NumChannels
    wavBuffer.writeUInt32LE(sampleRate, 24);   // SampleRate
    wavBuffer.writeUInt32LE(byteRate, 28);     // ByteRate
    wavBuffer.writeUInt16LE(blockAlign, 32);   // BlockAlign
    wavBuffer.writeUInt16LE(bitsPerSample, 34);// BitsPerSample
    
    // data chunk
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    
    // Copy PCM data
    pcmBuffer.copy(wavBuffer, headerSize);
    
    return wavBuffer.toString('base64');
}

/**
 * Voice configuration for meditation (Gemini TTS voices)
 * Selected for calm, soothing qualities ideal for meditation
 * 
 * Available voices (30 total):
 * - Zephyr (Bright), Puck (Upbeat), Charon (Informative), Kore (Firm)
 * - Fenrir (Excitable), Leda (Youthful), Orus (Firm), Aoede (Breezy)
 * - Callirrhoe (Easy-going), Autonoe (Bright), Enceladus (Breathy)
 * - Iapetus (Clear), Umbriel (Easy-going), Algieba (Smooth)
 * - Despina (Smooth), Erinome (Clear), Algenib (Gravelly)
 * - Rasalgethi (Informative), Laomedeia (Upbeat), Achernar (Soft)
 * - Alnilam (Firm), Schedar (Even), Gacrux (Mature)
 * - Pulcherrima (Forward), Achird (Friendly), Zubenelgenubi (Casual)
 * - Vindemiatrix (Gentle), Sadachbia (Lively), Sadaltager (Knowledgeable)
 * - Sulafat (Warm)
 */
const VOICE_CONFIG = {
    'es-latam': {
        male: 'Sulafat',       // Warm - ideal for calming male voice
        female: 'Achernar',    // Soft - gentle female voice for meditation
        neutral: 'Aoede',      // Breezy - serene neutral option
    },
    'en': {
        male: 'Sulafat',       // Warm - soothing male voice
        female: 'Vindemiatrix', // Gentle - calming female voice
        neutral: 'Enceladus',  // Breathy - ethereal neutral voice
    },
};

// Voice descriptions for documentation
const VOICE_DESCRIPTIONS = {
    'Sulafat': 'Warm - Soothing and comforting',
    'Achernar': 'Soft - Gentle and delicate',
    'Aoede': 'Breezy - Light and serene',
    'Vindemiatrix': 'Gentle - Calm and peaceful',
    'Enceladus': 'Breathy - Ethereal and meditative',
};

/**
 * Health check endpoint
 */
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'TTS API Pro',
        model: TTS_MODEL
    });
});

/**
 * Helper function to call TTS with timeout
 */
async function generateTTSWithTimeout(fullText, voiceName, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text: fullText }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voiceName,
                        },
                    },
                },
            },
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Generate narration audio
 * POST /synthesize
 * Body: { text, gender, contentLanguage }
 */
app.post('/synthesize', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { text, gender = 'neutral', contentLanguage = 'es-latam' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const voiceName = VOICE_CONFIG[contentLanguage]?.[gender] || 'Aoede';

        console.log(`[TTS API] Request: voice=${voiceName}, lang=${contentLanguage}, textLen=${text.length}`);

        // Minimal style prompt for faster processing
        const stylePrompt = contentLanguage === 'es-latam'
            ? 'Habla en un susurro suave y cercano, con un ritmo muy lento, pausas prolongadas entre frases y un tono cálido tipo ASMR:'
            : 'Speak in a soft whisper, very slow rhythm, long pauses between phrases, and a warm tone like ASMR:';

        const fullText = `${stylePrompt} ${text}`;

        // Try up to 2 times
        let lastError;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[TTS API] Attempt ${attempt}/2...`);
                
                const response = await generateTTSWithTimeout(fullText, voiceName, REQUEST_TIMEOUT_MS);

                // Extract audio data from response
                const candidate = response.candidates?.[0];
                if (!candidate?.content?.parts) {
                    throw new Error('No audio content in response');
                }

                const audioPart = candidate.content.parts.find(part => part.inlineData);
                if (!audioPart?.inlineData?.data) {
                    throw new Error('No audio data found in response');
                }

                const rawAudioBase64 = audioPart.inlineData.data;
                const rawMimeType = audioPart.inlineData.mimeType || 'audio/L16;rate=24000';

                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[TTS API] Received in ${duration}s: voice=${voiceName}, rawMimeType=${rawMimeType}, rawSize=${rawAudioBase64.length} chars`);

                // Convert PCM to WAV if needed (Gemini TTS returns L16 PCM)
                let audioBase64 = rawAudioBase64;
                let mimeType = rawMimeType;
                
                if (rawMimeType.includes('L16') || rawMimeType.includes('pcm')) {
                    console.log('[TTS API] Converting PCM to WAV...');
                    audioBase64 = pcmToWav(rawAudioBase64);
                    mimeType = 'audio/wav';
                    console.log(`[TTS API] WAV conversion complete, size=${audioBase64.length} chars`);
                }

                return res.json({ 
                    audioContent: audioBase64,
                    mimeType: mimeType,
                    voice: voiceName,
                    language: contentLanguage
                });

            } catch (error) {
                lastError = error;
                console.error(`[TTS API] Attempt ${attempt} failed:`, error.message);
                
                if (attempt < 2) {
                    console.log('[TTS API] Retrying in 1 second...');
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        // All attempts failed
        throw lastError;

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`[TTS API] Failed after ${duration}s:`, error.message);
        
        // Provide more helpful error message
        let userMessage = error.message;
        if (error.message.includes('fetch failed') || error.message.includes('ECONNRESET')) {
            userMessage = 'Connection to Gemini API failed. Please try again.';
        } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
            userMessage = 'Request timed out. The text might be too long.';
        }
        
        res.status(500).json({ error: userMessage });
    }
});

/**
 * List available voices
 * GET /voices
 */
app.get('/voices', (req, res) => {
    res.json({
        model: TTS_MODEL,
        voices: VOICE_CONFIG,
        descriptions: VOICE_DESCRIPTIONS,
        allAvailableVoices: [
            'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
            'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
            'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
            'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
            'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
        ],
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           TTS API Pro - Gemini 2.5 Pro TTS                ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                            ║
║  Model:  ${TTS_MODEL}            ║
║  Timeout: ${REQUEST_TIMEOUT_MS/1000}s | Retries: 2                             ║
║                                                           ║
║  Voices for meditation:                                   ║
║    ES: Sulafat (M), Achernar (F), Aoede (N)              ║
║    EN: Sulafat (M), Vindemiatrix (F), Enceladus (N)      ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /         - Health check                          ║
║    POST /synthesize - Generate narration                  ║
║    GET  /voices   - List available voices                 ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
