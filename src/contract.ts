export type TriangleSample = {
  time: number;
  coordinates: Record<string, number | null>;
  confidence: Record<string, number>;
  evidence: Record<string, { state: string; missingSymbols?: string[] }>;
};

export function serviceProxyBase(serviceRef: { namespace: string; name: string; port: number }) {
  return `/api/v1/namespaces/${encodeURIComponent(
    serviceRef.namespace
  )}/services/http:${encodeURIComponent(serviceRef.name)}:${serviceRef.port}/proxy`;
}

export function completeSamples(vertices: string[], samples: TriangleSample[]) {
  return samples.filter(sample =>
    vertices.every(vertex => typeof sample.coordinates[vertex] === 'number')
  );
}

export function relationshipSeriesPath(relationshipId: string, subject: string) {
  return `/api/v1/relationships/${encodeURIComponent(
    relationshipId
  )}/series?subject=${encodeURIComponent(subject)}&maxPoints=7`;
}

type ObservationResponse = {
  ok: boolean;
  status?: number;
  headers?: { get(name: string): string | null };
  json(): Promise<any>;
};

export type ObservationRequest = (path: string) => Promise<ObservationResponse>;

function retryDelay(response: ObservationResponse, attempt: number) {
  const retryAfter = response.headers?.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 1000 * 2 ** attempt;
}

function message(document: any, status?: number) {
  const summary = document?.error || `HTTP ${status || 'unavailable'}`;
  return document?.detail ? `${summary}: ${document.detail}` : summary;
}

export async function requestObservation(
  request: ObservationRequest,
  path: string,
  sleep: (milliseconds: number) => Promise<void> = milliseconds =>
    new Promise(resolve => window.setTimeout(resolve, milliseconds))
) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await request(path);
    const document = await response.json();
    if (response.ok) return document;
    const detail = `${document?.error || ''} ${document?.detail || ''}`;
    const limited = response.status === 429 || /\b429\b|too many requests/i.test(detail);
    if (!limited || attempt === 3) throw new Error(message(document, response.status));
    await sleep(retryDelay(response, attempt));
  }
  throw new Error('Advanced Fabric observation API request failed');
}
