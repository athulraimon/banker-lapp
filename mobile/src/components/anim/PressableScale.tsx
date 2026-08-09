import React, { useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useNativeDriver } from '../../theme/motion';

interface Props extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // How far the target shrinks while held. 1 disables the effect.
  scaleTo?: number;
}

// Drop-in replacement for TouchableOpacity that gives a subtle spring-scale on
// press instead of an opacity flash — the tactile feedback modern apps use.
// Keeps the visual style on the animated inner view so existing card styles
// carry over unchanged.
export default function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver,
      speed: 45,
      bounciness: 0,
    }).start();

  const handlePressIn = (e: GestureResponderEvent) => {
    springTo(scaleTo);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    springTo(1);
    onPressOut?.(e);
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
