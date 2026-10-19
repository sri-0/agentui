import { toWav } from "@/lib/audio/wav";

import { apiFetch } from "./client";

/** The server's limit on a recording: about 13 minutes of 16 kHz WAV. */
const MAX_BYTES = 25 * 2 ** 20;

/** The text of a spoken prompt: the recording, as WAV, through the server's
 *  transcription model (POST /v1/voice/transcriptions). */
export async function transcribe(recording: Blob): Promise<string> {
  const wav = await toWav(recording);
  if (wav.size > MAX_BYTES) throw new Error("the recording is too long (about 13 minutes at most)");
  const form = new FormData();
  form.set("file", wav, "prompt.wav");
  const { text } = await apiFetch<{ text: string }>("/v1/voice/transcriptions", { method: "POST", body: form });
  return text;
}
