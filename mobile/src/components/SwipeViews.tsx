import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface Props {
  index: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode; // one node per page
}

// Horizontal paged container that lets the user swipe between sibling pages and
// stays in sync with an external tab control. Built on a paging ScrollView so it
// works on both native and web with no extra native dependency. The pages are
// already-scrollable content (a vertical ScrollView or FlatList) — a horizontal
// outer + vertical inner is a different orientation, so there is no nested
// virtualization warning.
export default function SwipeViews({ index, onIndexChange, children }: Props) {
  const ref = useRef<ScrollView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pages = React.Children.toArray(children);

  // Latest controlled index, read inside the debounced settle callback without
  // making it a dependency.
  const indexRef = useRef(index);
  indexRef.current = index;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the external index (tab taps) by scrolling to the matching page.
  useEffect(() => {
    if (size.w > 0) ref.current?.scrollTo({ x: index * size.w, animated: true });
  }, [index, size.w]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  // Report the page a scroll settled on. Clamped to a valid page index.
  const settle = (x: number) => {
    if (!size.w) return;
    const i = Math.max(0, Math.min(pages.length - 1, Math.round(x / size.w)));
    if (i !== indexRef.current) onIndexChange(i);
  };

  // onMomentumScrollEnd is the clean native signal, but react-native-web never
  // fires it — so also debounce onScroll, which fires on both platforms, and
  // settle once the swipe stops.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
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
