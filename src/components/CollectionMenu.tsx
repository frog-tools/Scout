import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Appbar, List, Portal, useTheme } from 'react-native-paper';
import type { LayoutRectangle } from 'react-native';

interface Props {
  onSelectAll: () => void;
  onSelectNotOnRed: () => void;
  onSelectNoRedStatus: () => void;
  hasRedApiKey: boolean;
  hasAlbums: boolean;
}

const ANIM_DURATION = 200;
const EASING = Easing.bezier(0.4, 0, 0.2, 1);

export default function CollectionMenu({
  onSelectAll,
  onSelectNotOnRed,
  onSelectNoRedStatus,
  hasRedApiKey,
  hasAlbums,
}: Props) {
  const theme = useTheme();
  const [rendered, setRendered] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle>({ x: 0, y: 0, width: 0, height: 0 });
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const anchorRef = useRef<View>(null);

  const open = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setRendered(true);
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: ANIM_DURATION,
          easing: EASING,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ANIM_DURATION,
          easing: EASING,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [scaleAnim, opacityAnim]);

  const close = useCallback(() => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setRendered(false);
      scaleAnim.setValue(0);
    });
  }, [scaleAnim, opacityAnim]);

  useEffect(() => {
    if (!rendered) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [rendered, close]);

  const makeHandler = (action: () => void) => () => {
    action();
    close();
  };

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Appbar.Action icon="dots-vertical" onPress={open} disabled={!hasAlbums} />
      </View>
      {rendered && (
        <Portal>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <Animated.View
            style={[
              styles.menu,
              {
                top: anchor.y + anchor.height,
                left: anchor.x + anchor.width - styles.menu.minWidth,
                opacity: opacityAnim,
                backgroundColor: theme.colors.elevation.level2,
                transformOrigin: 'top right',
                transform: [
                  {
                    scaleX: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                  {
                    scaleY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <List.Item
              title="Select all"
              left={(props) => <List.Icon {...props} icon="select-all" />}
              onPress={makeHandler(onSelectAll)}
              style={styles.item}
            />
            {hasRedApiKey && (
              <>
                <List.Item
                  title="Select items not on RED"
                  left={(props) => <List.Icon {...props} icon="party-popper" />}
                  onPress={makeHandler(onSelectNotOnRed)}
                  style={styles.item}
                />
                <List.Item
                  title="Select items missing RED data"
                  left={(props) => <List.Icon {...props} icon="help-circle-outline" />}
                  onPress={makeHandler(onSelectNoRedStatus)}
                  style={styles.item}
                />
              </>
            )}
          </Animated.View>
        </Portal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: 300,
    borderRadius: 8,
    paddingVertical: 8,
  },
  item: {
    paddingVertical: 4,
  },
});
