import React, { useState } from 'react';
import { useWindowDimensions, useColorScheme, StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TabView, type Route } from 'react-native-tab-view';
import { StatusBar } from 'expo-status-bar';
import { CollectionProvider } from './src/context/CollectionContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { lightTheme, darkTheme } from './src/theme';
import TabBar from './src/components/TabBar';
import CollectionScreen from './src/screens/CollectionScreen';
import ScanScreen from './src/screens/ScanScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const routes: Route[] = [
  { key: 'collection', title: 'Collection' },
  { key: 'scan', title: 'Scan' },
  { key: 'settings', title: 'Settings' },
];

const renderScene = ({ route }: { route: Route }) => {
  switch (route.key) {
    case 'collection':
      return <CollectionScreen />;
    case 'scan':
      return <ScanScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return null;
  }
};

function AppContent() {
  const layout = useWindowDimensions();
  const colorScheme = useColorScheme();
  const [index, setIndex] = useState(0);
  const { settings } = useSettings();

  const isDark =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && colorScheme === 'dark');
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <CollectionProvider>
        <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
          <TabBar
            navigationState={{ index, routes }}
            jumpTo={(key) => {
              const i = routes.findIndex((r) => r.key === key);
              if (i !== -1) setIndex(i);
            }}
            layout={layout}
            position={undefined as any}
          />
          <TabView
            navigationState={{ index, routes }}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: layout.width }}
            renderTabBar={() => null}
            lazy
          />
        </SafeAreaView>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </CollectionProvider>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
