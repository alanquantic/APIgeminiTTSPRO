# TTS API Pro

API de Text-to-Speech usando **Gemini 2.5 Pro TTS** via Google Generative AI.
Optimizado para narración de meditación con voces de alta calidad.

## Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar API Key

Crea un archivo `.env` con tu Gemini API Key:

```bash
GEMINI_API_KEY=tu_api_key_aqui
PORT=3001
```

Puedes obtener tu API Key en: https://aistudio.google.com/apikey

### 3. Iniciar el servidor

```bash
npm start
```

O en modo desarrollo (auto-reload):

```bash
npm run dev
```

## Endpoints

### GET /
Health check

### POST /synthesize
Genera audio de narración.

**Body:**
```json
{
  "text": "Texto a narrar...",
  "gender": "male" | "female" | "neutral",
  "contentLanguage": "es-latam" | "en"
}
```

**Response:**
```json
{
  "audioContent": "base64...",
  "mimeType": "audio/wav",
  "voice": "Aoede",
  "language": "es-latam"
}
```

### GET /voices
Lista las voces disponibles.

## Voces configuradas para meditación

### Español (es-latam)
| Género | Voz | Estilo |
|--------|-----|--------|
| male | Sulafat | Cálida, reconfortante |
| female | Achernar | Suave, delicada |
| neutral | Aoede | Serena, tranquila |

### Inglés (en)
| Género | Voz | Estilo |
|--------|-----|--------|
| male | Sulafat | Warm, soothing |
| female | Vindemiatrix | Gentle, calming |
| neutral | Enceladus | Breathy, meditative |

## Notas técnicas

- Modelo: `gemini-2.5-pro-preview-tts`
- Formato de audio: WAV (PCM 24kHz)
- El audio se devuelve en base64
- Temperature: 0 (para consistencia de voz)

## Todas las voces disponibles (30)

Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, 
Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, 
Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, 
Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat
