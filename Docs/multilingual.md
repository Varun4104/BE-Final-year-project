# Multilingual & Translation

The multilingual feature uses **Google Gemini 2.5 Flash** to translate text between 12 languages, with additional text-to-speech playback in the target language.

## Translation Endpoint

```python
# backend/main.py
class TranslationRequest(BaseModel):
    text: str
    target_language: str   # e.g., "Spanish", "Japanese"

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    prompt = f"Translate the following text to {request.target_language}:\n\n{request.text}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 1024}
    }

    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        },
        json=payload
    )

    translated_text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    return {
        "original_text": request.text,
        "translated_text": translated_text,
        "target_language": request.target_language
    }
```

The API key is read from the `GEMINI_API_KEY` environment variable.

## Supported Languages

| Code | Language | Flag |
|------|----------|------|
| `en` | English | 🇺🇸 |
| `es` | Spanish | 🇪🇸 |
| `fr` | French | 🇫🇷 |
| `de` | German | 🇩🇪 |
| `it` | Italian | 🇮🇹 |
| `pt` | Portuguese | 🇵🇹 |
| `ru` | Russian | 🇷🇺 |
| `zh` | Chinese | 🇨🇳 |
| `ja` | Japanese | 🇯🇵 |
| `ko` | Korean | 🇰🇷 |
| `ar` | Arabic | 🇸🇦 |
| `hi` | Hindi | 🇮🇳 |

## Frontend Call

```typescript
const handleTranslate = async () => {
  const response = await fetch("http://localhost:8000/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: textToTranslate,
      target_language: languages.find(l => l.code === selectedLanguage)?.name
      // resolves "es" → "Spanish" for the prompt
    })
  })
  const data = await response.json()
  setTranslationResult({
    originalText: data.original_text,
    translatedText: data.translated_text,
    targetLanguage: selectedLanguage
  })
}
```

## Text-to-Speech in Target Language

After translation, the result can be read aloud using the browser's SpeechSynthesis API with the correct locale:

```typescript
const speakTranslation = (text: string, langCode: string) => {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = langCode    // e.g., "es-ES", "ja-JP"
  speechSynthesis.speak(utterance)
}
```

## Summary Generation

The same Gemini integration powers AI paper summarisation:

```python
@app.post("/generate_summary")
async def generate_summary(file_id: str = Form(...), max_summary_length: int = Form(300)):
    text = extract_text_from_pdf(paper.file_path)
    truncated_text = text[:8000]   # Gemini context window guard
    prompt = f"Summarize this in {max_summary_length} words:\n\n{truncated_text}"
    # Same Gemini call pattern
```

## Notes

- **No caching:** Every translation is a live Gemini API call. For repeated translations (e.g., paper abstracts) a cache layer (Redis, or a `translations` DB table) would reduce latency and API costs.
- **Context limit:** The translate endpoint sends raw text with a 1024-token output cap. Very long texts should be split into paragraphs first.
- **Multilingual search:** The frontend can display results in different languages, but the backend searches the raw English-language embeddings. True multilingual retrieval would require multilingual embeddings (e.g., `paraphrase-multilingual-MiniLM-L12-v2`).
