import React, { useState } from 'react';
import { useWindowDimensions, StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TabView, type Route } from 'react-native-tab-view';
import { StatusBar } from 'expo-status-bar';
import { CollectionProvider } from './src/context/CollectionContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { lightTheme } from './src/theme';
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

export default function App() {
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(0);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PaperProvider theme={lightTheme}>
          <SettingsProvider>
            <CollectionProvider>
              <SafeAreaView style={styles.root} edges={['top']}>
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
              <StatusBar style="auto" />
            </CollectionProvider>
          </SettingsProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
