# Voice Search

Voice search lets users speak a natural language query. The system captures audio, transcribes it, extracts structured search parameters from the transcript, then runs an advanced search against the backend.

## Components Used

| API | Purpose |
|-----|---------|
| `SpeechRecognition` (Web Speech API) | Speech-to-text transcription |
| `MediaDevices.getUserMedia` | Microphone access |
| `AudioContext` + `AnalyserNode` (Web Audio API) | Real-time voice level visualization |
| `SpeechSynthesisUtterance` | Text-to-speech playback of abstracts |

## Speech Recognition Setup

```typescript
// Both fallbacks supported — Chrome uses webkitSpeechRecognition,
// Firefox/Edge may use SpeechRecognition
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

const recognition = new SpeechRecognition()
recognition.continuous = false       // stop after one utterance
recognition.interimResults = false   // only fire onresult when final
recognition.lang = "en-US"
```

**Why `continuous = false`:** With `continuous = true` the API fires `onresult` repeatedly for interim results, which would trigger multiple searches mid-sentence. Setting it to `false` fires once when the user stops speaking.

## onresult Handler

```typescript
recognition.onresult = (event: any) => {
  const result = event.results[0][0]
  setTranscript(result.transcript)      // display to user
  setConfidence(result.confidence)      // shown as percentage badge
  setSearchQuery(result.transcript)
  handleVoiceSearch(result.transcript)  // kick off search
}
```

## Audio Level Visualization

While listening, a real-time volume meter is shown using FFT frequency analysis:

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
mediaStreamRef.current = stream   // stored so tracks can be stopped later

const audioContext = new AudioContext()
const analyser = audioContext.createAnalyser()
const microphone = audioContext.createMediaStreamSource(stream)
microphone.connect(analyser)
analyser.fftSize = 256   // 128 frequency bins

const dataArray = new Uint8Array(analyser.frequencyBinCount)

const updateAudioLevel = () => {
  if (isListeningRef.current) {   // uses ref to avoid stale closure
    analyser.getByteFrequencyData(dataArray)
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length
    setVoiceLevel(Math.min(100, (average / 255) * 100))
    animationRef.current = requestAnimationFrame(updateAudioLevel)
  }
}
updateAudioLevel()
```

**Note on stale closure:** The animation loop runs inside a `requestAnimationFrame` callback. If it read `isListening` state directly, it would always see the value from when the loop started (stale closure). Using `isListeningRef.current` (kept in sync via a `useEffect`) solves this.

## Intent Extraction

The transcript is parsed with regex to extract structured search parameters:

```typescript
const parseVoiceInput = (input: string) => {
  // "papers by John Smith" → author: "John Smith"
  const authorMatch = input.match(
    /(?:by|author|from|written by)\s+([A-Za-z\s]+?)(?:\s+(?:about|on|for)|\s*$)/i
  )

  // "about neural networks" → title: "neural networks"
  const titleMatch = input.match(
    /(?:about|on|titled|regarding)\s+([A-Za-z0-9\s&-]+?)(?:\s+(?:by|published)|\s*$)/i
  )

  // "keywords artificial intelligence" → keywords: "artificial intelligence"
  const keywordsMatch = input.match(
    /(?:keywords?|topics?|about)\s+([A-Za-z0-9\s,&-]+?)(?:\s+(?:by|author)|\s*$)/i
  )

  // "from 2023" / "in 2022" → year: "2023"
  const yearMatch = input.match(/(?:from|in|year|published)?\s+(\d{4})/)

  return { author, title, keywords, year }
}
```

If no structured parameters are extracted, the full transcript is used as a title search.

## Search Dispatch

The extracted parameters are sent to `POST /search` as an advanced search:

```typescript
const formData = new URLSearchParams()
formData.append("search_type", "advanced")
if (params.title)    formData.append("title", params.title)
if (params.author)   formData.append("author", params.author)
if (params.keywords) formData.append("keywords", params.keywords)
if (params.year)     formData.append("year", params.year)

// Fallback: use raw transcript as title search
if (!params.title && !params.author && !params.keywords && !params.year) {
  formData.append("title", query)
}

await fetch(`${API_URL}/search`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: formData.toString(),
})
```

## Cleanup on Unmount

All browser resources are released when the component unmounts:

```typescript
return () => {
  cancelAnimationFrame(animationRef.current)
  recognitionRef.current?.abort()                           // stop recognition
  mediaStreamRef.current?.getTracks().forEach(t => t.stop()) // release mic
  audioContextRef.current?.close()                          // close audio graph
}
```

## Text-to-Speech (Read Aloud)

Search results can be read aloud using the browser's SpeechSynthesis API:

```typescript
const speakText = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "en-US"
  utterance.onend = () => setIsSpeaking(false)
  speechSynthesis.speak(utterance)
}
```

## Example Voice Commands

| Spoken Query | Extracted Params |
|---|---|
| "papers by Yann LeCun about convolutional networks" | author="Yann LeCun", title="convolutional networks" |
| "research on attention mechanisms from 2017" | title="attention mechanisms", year="2017" |
| "find papers about reinforcement learning" | title="reinforcement learning" |
| "transformer NLP" | title="transformer NLP" (raw fallback) |
