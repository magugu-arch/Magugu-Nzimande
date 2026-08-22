import fs from 'node:fs';
import path from 'node:path';

const assets = path.resolve(__dirname, '..', 'assets');

/** Read a PNG's dimensions from its IHDR chunk, which is always the first one. */
function pngSize(file: string): { width: number; height: number } {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, head, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }

  expect(head.subarray(1, 4).toString()).toBe('PNG');
  expect(head.subarray(12, 16).toString()).toBe('IHDR');

  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

describe('brand masters', () => {
  it('ships both logo masters', () => {
    for (const master of ['bbq-lockup.png', 'bbq-symbol.png']) {
      expect(fs.existsSync(path.join(assets, 'brand', 'masters', master))).toBe(true);
    }
  });

  // BrandMark derives its height from a hardcoded ratio so a caller can never
  // stretch the lock-up. That is only true while the constant agrees with the
  // artwork, and replacing the master is exactly when it would stop agreeing.
  it("matches the aspect ratio BrandMark draws at", () => {
    const { width, height } = pngSize(path.join(assets, 'brand', 'masters', 'bbq-lockup.png'));
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'components', 'brand', 'BrandMark.tsx'),
      'utf8',
    );

    const declared = /const ASPECT = (\d+) \/ (\d+);/.exec(source);
    expect(declared).not.toBeNull();
    expect(Number(declared?.[1])).toBe(width);
    expect(Number(declared?.[2])).toBe(height);
  });

  it('keeps the symbol master square enough to centre in an icon', () => {
    const { width, height } = pngSize(path.join(assets, 'brand', 'masters', 'bbq-symbol.png'));
    expect(Math.abs(width / height - 1)).toBeLessThan(0.05);
  });
});

describe('generated brand assets', () => {
  // Every one of these is named in app.json. A missing or wrongly sized file
  // fails at prebuild, which is a slower and much less obvious place to learn.
  const expected: Array<[string, number, number]> = [
    ['icon.png', 1024, 1024],
    ['android-icon-foreground.png', 1024, 1024],
    ['android-icon-background.png', 1024, 1024],
    ['android-icon-monochrome.png', 1024, 1024],
    ['notification-icon.png', 96, 96],
    ['favicon.png', 48, 48],
    ['brand/lockup.png', 240, 43],
    ['brand/lockup@2x.png', 480, 86],
    ['brand/lockup@3x.png', 720, 129],
    ['brand/lockup-reversed.png', 240, 43],
    ['brand/lockup-reversed@2x.png', 480, 86],
    ['brand/lockup-reversed@3x.png', 720, 129],
  ];

  it.each(expected)('%s is %ix%i', (file, width, height) => {
    expect(pngSize(path.join(assets, file))).toEqual({ width, height });
  });

  it('gives the splash the lock-up proportions, not a square', () => {
    const { width, height } = pngSize(path.join(assets, 'splash-icon.png'));
    expect(width / height).toBeGreaterThan(5);
  });
});
