// The subpath, not the package root: the root pulls in every icon font.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName | string;
  size?: number;
  color: string;
}

/** Icons are decorative here: the label always lives on the control around them. */
export function Icon({ name, size = 22, color }: IconProps) {
  const known = name in Ionicons.glyphMap ? (name as IconName) : 'ellipse-outline';
  return (
    <Ionicons
      name={known}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
