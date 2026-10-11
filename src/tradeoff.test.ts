import { describe, expect, it } from 'vitest';
import {
  completeSamples,
  relationshipSeriesPath,
  requestObservation,
  serviceProxyBase,
} from './contract';

describe('public observation contract', () => {
  it('discovers the API only through the advertised service reference', () => {
    expect(serviceProxyBase({ namespace: 'fabric-a', name: 'observations', port: 8080 })).toBe(
      '/api/v1/namespaces/fabric-a/services/http:observations:8080/proxy'
    );
  });

  it('draws only producer-complete coordinates and never substitutes null with zero', () => {
    const samples: any[] = [
      { time: 1, coordinates: { R: 0.2, D: 0.5, C: 0.9 }, confidence: {}, evidence: {} },
      { time: 2, coordinates: { R: 0.2, D: null, C: 0.9 }, confidence: {}, evidence: {} },
    ];
    expect(completeSamples(['R', 'D', 'C'], samples)).toEqual([samples[0]]);
    expect(samples[1].coordinates.D).toBeNull();
  });

  it('uses a stable producer-managed series window', () => {
    expect(relationshipSeriesPath('redundancy-independence-churn', 'r640')).toBe(
      '/api/v1/relationships/redundancy-independence-churn/series?subject=r640&maxPoints=100'
    );
    expect(
      relationshipSeriesPath('redundancy-independence-churn', 'r640', {
        start: 100.9,
        end: 200.7,
        maxPoints: 80,
      })
    ).toBe(
      '/api/v1/relationships/redundancy-independence-churn/series?subject=r640&maxPoints=80&start=100&end=200'
    );
  });

  it('retries direct and wrapped rate limits before surfacing an error', async () => {
    const responses = [
      {
        ok: false,
        status: 503,
        json: async () => ({
          error: 'observation data unavailable',
          detail: 'HTTP Error 429: Too Many Requests',
        }),
      },
      {
        ok: false,
        status: 429,
        headers: { get: () => '0' },
        json: async () => ({ error: 'limited' }),
      },
      { ok: true, status: 200, json: async () => ({ items: ['ready'] }) },
    ];
    const sleeps: number[] = [];
    const result = await requestObservation(
      async () => responses.shift() as any,
      '/api/v1/subjects',
      async milliseconds => {
        sleeps.push(milliseconds);
      }
    );
    expect(result).toEqual({ items: ['ready'] });
    expect(sleeps).toEqual([1000, 0]);
  });
});
