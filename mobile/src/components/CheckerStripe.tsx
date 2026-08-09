import React from 'react';
import { View } from 'react-native';

// A thin checkered flag stripe used along the top edge of hero cards. RN has no
// repeating-linear-gradient, so we lay out alternating cells by hand.
export default function CheckerStripe({
  colorA,
  colorB,
  height = 6,
  cell = 10,
}: {
  colorA: string;
  colorB: string;
  height?: number;
  cell?: number;
}) {
  // 40 cells comfortably overflows any phone-width card; the parent clips it.
  const cells = Array.from({ length: 40 });
  return (
    <View style={{ height, flexDirection: 'row', overflow: 'hidden' }}>
      {cells.map((_, i) => (
        <View key={i} style={{ width: cell, height, backgroundColor: i % 2 === 0 ? colorA : colorB }} />
      ))}
    </View>
  );
}
