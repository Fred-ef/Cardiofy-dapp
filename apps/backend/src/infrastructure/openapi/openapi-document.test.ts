import { describe, it, expect } from 'vitest';
import { buildOpenApiDocument } from './openapi-document.js';

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument('http://localhost:3001');

  it('emits a 3.1.0 spec with info + servers', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Cardiofy — Blockchain Module API');
    expect(doc.servers).toEqual([{ url: 'http://localhost:3001' }]);
  });

  it('declares all current endpoints under /api/v1', () => {
    const paths = Object.keys(doc.paths ?? {});
    expect(paths).toEqual(expect.arrayContaining([
      '/api/v1/assets/{assetId}/notarize',
      '/api/v1/assets/{assetId}',
      '/api/v1/contracts/{contractId}/notarize',
      '/api/v1/contracts/{contractId}',
      '/api/v1/views',
      '/api/v1/batches/{periodId}',
      '/api/v1/chain/info',
      '/api/v1/health/live',
      '/api/v1/health/ready',
    ]));
  });

  it('declares a bearerAuth security scheme', () => {
    expect(doc.components?.securitySchemes?.['bearerAuth']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('does not require auth on public paths', () => {
    const paths = doc.paths!;
    const chainInfo = paths['/api/v1/chain/info']!.get!;
    const healthLive = paths['/api/v1/health/live']!.get!;
    expect(chainInfo.security).toBeUndefined();
    expect(healthLive.security).toBeUndefined();
  });

  it('requires bearerAuth on protected paths', () => {
    const paths = doc.paths!;
    const notarizeAsset = paths['/api/v1/assets/{assetId}/notarize']!.post!;
    expect(notarizeAsset.security).toEqual([{ bearerAuth: [] }]);
  });

  it('every endpoint declares at least a 2xx response', () => {
    const paths = Object.values(doc.paths ?? {});
    for (const pathItem of paths) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
        const op = (pathItem as Record<string, unknown>)[method];
        if (!op) continue;
        const responses = (op as { responses: Record<string, unknown> }).responses;
        const has2xx = Object.keys(responses).some((code) => code.startsWith('2'));
        expect(has2xx, `path ${method} should declare a 2xx response`).toBe(true);
      }
    }
  });
});
