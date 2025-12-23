export async function fetchTranscription(baseUrl: string, roundId: string) {
  if (!baseUrl) {
    throw new Error("TRANSCRIPTION_BASE_URL is not configured");
  }

  const response = await fetch(`${baseUrl}/api/rounds/${roundId}/transcription`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || `Transcription service returned ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export async function fetchRounds(baseUrl: string) {
  if (!baseUrl) {
    throw new Error("TRANSCRIPTION_BASE_URL is not configured");
  }

  const response = await fetch(`${baseUrl}/api/rounds`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || `Transcription service returned ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
