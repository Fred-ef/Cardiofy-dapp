import { describe, it, expect } from 'vitest';
import { OpenApiController } from './openapi.controller.js';
import { makeAppConfigMock } from '#tests/support/mocks.js';

describe('OpenApiController', () => {
  it('builds the OpenAPI document with the configured server port', () => {
    const cfg = makeAppConfigMock();
    cfg.env.SERVER.PORT = 4242;
    const doc = new OpenApiController(cfg).json() as { openapi?: string; servers?: { url: string }[] };

    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.servers?.[0]?.url).toBe('http://localhost:4242');
  });
});
