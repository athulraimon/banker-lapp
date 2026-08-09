import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Animated, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface Props {
  index: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode; // one node per page
  // Optional shared value updated live during a swipe with the page progress
  // (0 … pages-1), so a tab control can slide its indicator in step. Normalised
  // here against the measured page width, so callers never need to know it.
  progress?: Animated.Value;
}

// Horizontal paged container that lets the user swipe between sibling pages and
// stays in sync with an external tab control. A plain paging ScrollView so it
// works on native and web with no extra native dependency.
export default function SwipeViews({ index, onIndexChange, children, progress }: Props) {
  const ref = useRef<ScrollView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pages = React.Children.toArray(children);

  const indexRef = useRef(index);
  indexRef.current = index;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the external index (tab taps) by scrolling to the matching page.
  useEffect(() => {
    if (size.w > 0) ref.current?.scrollTo({ x: index * size.w, animated: true });
  }, [index, size.w]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const settle = (offsetX: number) => {
    if (!size.w) return;
    const i = Math.max(0, Math.min(pages.length - 1, Math.round(offsetX / size.w)));
    if (i !== indexRef.current) onIndexChange(i);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    // Live progress for the moving indicator (normalised to page units).
    if (progress && size.w > 0) progress.setValue(x / size.w);
    // Debounced settle picks the landed page — the source of truth for the tab.
    // (onMomentumScrollEnd never fires on web, so this is what works there.)
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(x), 120);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => settle(e.nativeEvent.contentOffset.x);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
      }}
    >
      {size.w > 0 && (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumEnd}
          contentOffset={{ x: index * size.w, y: 0 }}
        >
          {pages.map((page, i) => (
            <View key={i} style={{ width: size.w, height: size.h }}>
              {page}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
