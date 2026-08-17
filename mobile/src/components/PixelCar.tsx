import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  CAR_BODY,
  CAR_H,
  CAR_W,
  CAR_WHEEL_FRAMES,
  PIXEL_PALETTE,
  WHEEL_CENTERS,
  wheelOffset,
} from '../theme/pixelCar';
import PixelSprite from './PixelSprite';

interface Props {
  // Size of one art pixel. The mark ends up CAR_W x CAR_H cells.
  cell?: number;
  // Which wheel frame to draw. Static uses of the mark keep frame 0.
  frame?: 0 | 1;
  style?: StyleProp<ViewStyle>;
}

// The app mark, at rest. PixelCarLoader is the moving version.
export default function PixelCar({ cell = 4, frame = 0, style }: Props) {
  const c = Math.max(1, Math.round(cell));

  return (
    <View style={[{ width: CAR_W * c, height: CAR_H * c }, style]}>
      <PixelSprite rows={CAR_BODY} palette={PIXEL_PALETTE} cell={c} />
      {WHEEL_CENTERS.map((centre, i) => {
        const { x, y } = wheelOffset(centre);
        return (
          <View key={i} style={{ position: 'absolute', left: x * c, top: y * c }}>
            <PixelSprite rows={CAR_WHEEL_FRAMES[frame]} palette={PIXEL_PALETTE} cell={c} />
          </View>
        );
      })}
    </View>
  );
}
