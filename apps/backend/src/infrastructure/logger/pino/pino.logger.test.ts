import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PinoLogger } from './pino.logger.js';
import type { PinoProvider } from './pino.factory.js';

function makeProviderSpy() {
  const instance = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { provider: { instance } as unknown as PinoProvider, instance };
}

describe('PinoLogger', () => {
  let spy: ReturnType<typeof makeProviderSpy>;
  let log: PinoLogger;

  beforeEach(() => {
    spy = makeProviderSpy();
    log = new PinoLogger(spy.provider);
  });

  it('forwards info/warn/debug with meta (defaulting to {})', () => {
    log.info('hello', { a: 1 });
    log.warn('careful');
    log.debug('trace', { x: true });
    expect(spy.instance.info).toHaveBeenCalledWith({ a: 1 }, 'hello');
    expect(spy.instance.warn).toHaveBeenCalledWith({}, 'careful');
    expect(spy.instance.debug).toHaveBeenCalledWith({ x: true }, 'trace');
  });

  it('serializes an Error into a structured err payload', () => {
    const err = new Error('boom');
    log.error('failed', err, { ctx: 1 });
    expect(spy.instance.error).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: 1,
        err: expect.objectContaining({ message: 'boom', name: 'Error', stack: expect.any(String) }),
      }),
      'failed',
    );
  });

  it('passes through a non-Error thrown value as err, and omits err when undefined', () => {
    log.error('weird', 'string-failure');
    expect(spy.instance.error).toHaveBeenCalledWith({ err: 'string-failure' }, 'weird');

    spy.instance.error.mockClear();
    log.error('no-error-arg');
    expect(spy.instance.error).toHaveBeenCalledWith({}, 'no-error-arg');
  });
});
