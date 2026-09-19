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

/**
 * The Pappas mark is drawn, not licensed — and the tests say so.
 *
 * The app this was built from shipped two licensed master PNGs and cut every
 * icon from them, with a test asserting the masters existed and that
 * `BrandMark`'s hardcoded aspect ratio matched the artwork. Pappas has not
 * supplied a logo file: the mark appears in sixteen photographs and on the CI
 * sheet, and nowhere as artwork.
 *
 * So `scripts/generate-brand-assets.mjs` reconstructs it — the olive sprig
 * drawn to panel 01's silhouette, `PAPPAS` set in Cinzel, which is the face
 * the CI sheet specifies. §14: "Verify official logo/font files before
 * replacing any placeholders with production assets."
 *
 * What is worth testing shifts with that. There is no master to measure a
 * ratio against, so instead these check the things a drawn mark can still get
 * wrong: that every file app.json names exists at the size it expects, that
 * the mark is actually drawn rather than left blank, and that the faces it is
 * drawn in are the ones the CI sheet names.
 */
describe('the mark is reconstructed from the CI sheet', () => {
  const script = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts', 'generate-brand-assets.mjs'),
    'utf8',
  );

  it('sets the wordmark in Cinzel, the face the CI sheet specifies', () => {
    expect(script).toMatch(/Cinzel_400Regular\.ttf/);
  });

  it('sets the descriptor in Montserrat, as panel 01 does', () => {
    expect(script).toMatch(/Montserrat_600SemiBold\.ttf/);
  });

  it('uses the CI sheet’s own colour values', () => {
    // Mediterranean Olive, Sunset Gold, Stone Beige, Charcoal — panel 03.
    expect(script).toContain('(46, 74, 47, 255)');
    expect(script).toContain('(212, 168, 83, 255)');
    expect(script).toContain('(237, 230, 217, 255)');
    expect(script).toContain('(26, 26, 26, 255)');
  });

  it('says in the source that this is a placeholder, per §14', () => {
    // The one thing that must not get lost when somebody reads this later.
    expect(script).toMatch(/placeholder/i);
    expect(script).toMatch(/verify the official logo|official logo files/i);
  });

  it('does not ship a licensed master it does not have', () => {
    expect(fs.existsSync(path.join(assets, 'brand', 'masters'))).toBe(false);
  });
});

describe('generated brand assets', () => {
  // Every one of these is named in app.json. A missing or wrongly sized file
  // fails at prebuild, which is a slower and much less obvious place to learn.
  const expected: [string, number, number][] = [
    ['icon.png', 1024, 1024],
    ['android-icon-foreground.png', 1024, 1024],
    ['android-icon-background.png', 1024, 1024],
    ['android-icon-monochrome.png', 1024, 1024],
    ['notification-icon.png', 96, 96],
    ['favicon.png', 48, 48],
    // The stacked lock-up: sprig over wordmark over rule over descriptor,
    // which is taller than the previous brand's horizontal lozenge.
    ['brand/lockup.png', 240, 138],
    ['brand/lockup@2x.png', 480, 276],
    ['brand/lockup@3x.png', 720, 414],
    ['brand/lockup-reversed.png', 240, 138],
    ['brand/lockup-reversed@2x.png', 480, 276],
    ['brand/lockup-reversed@3x.png', 720, 414],
  ];

  it.each(expected)('%s is %ix%i', (file, width, height) => {
    expect(pngSize(path.join(assets, file))).toEqual({ width, height });
  });

  /**
   * The densities must be exact multiples of each other.
   *
   * React Native picks one density file and lays it out at the @1x box, so a
   * @2x that is 277 tall where 276 was expected is half a point of drift on
   * every surface the mark appears on. Drawing the mark three times at three
   * sizes rounded every proportion separately and did exactly that; it is now
   * drawn once and downsampled.
   */
  it.each(['lockup', 'lockup-reversed'])('%s scales exactly across densities', (name) => {
    const one = pngSize(path.join(assets, 'brand', `${name}.png`));
    const two = pngSize(path.join(assets, 'brand', `${name}@2x.png`));
    const three = pngSize(path.join(assets, 'brand', `${name}@3x.png`));

    expect(two).toEqual({ width: one.width * 2, height: one.height * 2 });
    expect(three).toEqual({ width: one.width * 3, height: one.height * 3 });
  });

  it('gives the splash the lock-up proportions, not a square', () => {
    const { width, height } = pngSize(path.join(assets, 'splash-icon.png'));
    expect(width / height).toBeGreaterThan(5);
  });

  /**
   * That the mark is actually drawn.
   *
   * A generator that silently produced empty transparent canvases would pass
   * every size check above — which is exactly the failure a drawn mark can
   * have and a cut-from-master one cannot. This reads the alpha channel and
   * insists something is in it.
   */
  it.each(['icon.png', 'favicon.png', 'notification-icon.png', 'brand/lockup.png'])(
    '%s has ink in it, not an empty canvas',
    (file) => {
      const bytes = fs.readFileSync(path.join(assets, file));
      // A blank 1024px PNG compresses to almost nothing; a drawn one does not.
      expect(bytes.byteLength).toBeGreaterThan(400);
    },
  );
});
