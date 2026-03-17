import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text, TextInput, List, Divider, RadioButton, useTheme } from 'react-native-paper';
import { version as appVersion } from '../../package.json';
import { useSettings } from '../context/SettingsContext';
import { useCollection } from '../context/CollectionContext';
import type { ThemeMode } from '../types';

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateToken, updateThemeMode, updateRedApiKey } = useSettings();
  const { albums } = useCollection();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <List.Section>
        <List.Subheader>Discogs API</List.Subheader>
        <View style={styles.inputContainer}>
          <TextInput
            label="Personal Access Token"
            value={settings.discogsToken}
            onChangeText={updateToken}
            mode="outlined"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            right={<TextInput.Icon icon="key" />}
          />
          <Text
            variant="bodySmall"
            style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
            onPress={() => Linking.openURL('https://www.discogs.com/settings/developers')}
          >
            Get a token at discogs.com/settings/developers. Adding a token increases the API rate limit.
          </Text>
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>RED (Redacted)</List.Subheader>
        <View style={styles.inputContainer}>
          <TextInput
            label="API Key"
            value={settings.redApiKey}
            onChangeText={updateRedApiKey}
            mode="outlined"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            right={<TextInput.Icon icon="key" />}
          />
          <Text
            variant="bodySmall"
            style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
          >
            Generate an API key for Torrents and Requests in your RED user settings. Enables checking whether scanned releases are already uploaded or requested.
          </Text>
        </View>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <RadioButton.Group
          value={settings.themeMode}
          onValueChange={(value) => updateThemeMode(value as ThemeMode)}
        >
          <RadioButton.Item label="System default" value="system" />
          <RadioButton.Item label="Light" value="light" />
          <RadioButton.Item label="Dark" value="dark" />
        </RadioButton.Group>
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Version"
          description={appVersion}
          left={(props) => <List.Icon {...props} icon="information-outline" />}
        />
        <List.Item
          title="Collection size"
          description={`${albums.length} release${albums.length !== 1 ? 's' : ''}`}
          left={(props) => <List.Icon {...props} icon="album" />}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  inputContainer: {
    paddingHorizontal: 16,
  },
  hint: {
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
