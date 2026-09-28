import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import QR from 'qrcode';
import { colors } from '@/theme';

/**
 * A QR code drawn with SVG from the `qrcode` encoder's module matrix — no
 * network, no image service. Dark modules on ivory, with a quiet zone, which
 * scanners read reliably off a phone screen at any brightness.
 */
export function QRCode({
  value,
  size = 180,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const { path, count } = useMemo(() => {
    const qr = QR.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);
  const quiet = 3;
  const view = count + quiet * 2;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${view} ${view}`}>
        <Rect x={-quiet} y={-quiet} width={view} height={view} fill={colors.text} />
        <Path d={path} fill={colors.background} />
      </Svg>
    </View>
  );
}
