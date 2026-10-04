import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import QR from 'qrcode';
import { colors } from '../tokens';

/**
 * A QR code drawn as one SVG path, for tickets and pickup codes. The matrix
 * comes from the `qrcode` encoder; nothing is fetched or rasterised.
 */
export function QRCode({
  value,
  size = 200,
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
        if (qr.modules.get(x, y)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
      }
    }
    return { path: d, count: n + 4 };
  }, [value]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect x={0} y={0} width={count} height={count} fill={colors.white} />
        <Path d={path} fill={colors.navy} />
      </Svg>
    </View>
  );
}
