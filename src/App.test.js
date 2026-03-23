/**
 * Full App test would require mocking Mapbox GL / WebGL in jsdom.
 * Smoke-check package identity after rebrand.
 */
test('package name is Closer to Care project slug', () => {
  // eslint-disable-next-line global-require
  expect(require('../package.json').name).toBe('closer-to-care');
});
