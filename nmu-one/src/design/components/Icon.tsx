import type { ComponentProps } from 'react';
// Per-family import: the package root requires every icon font.
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/**
 * Clear, simple icons (C.I. sheet "Icon style: simple & modern"). Icons are
 * decorative to assistive tech — the control around them carries the label.
 */
export function Icon({ name, size = 22, color = colors.textPrimary }: IconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
