import React, { useState } from 'react';
import { View, Image, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text, TextInput, List, Divider, RadioButton, Portal, Dialog, Button, useTheme } from 'react-native-paper';
import { version as appVersion } from '../../package.json';
import { useSettings } from '../context/SettingsContext';
import { useCollection } from '../context/CollectionContext';
import type { ThemeMode } from '../types';

const appIcon = require('../../assets/play-store-icon.png');

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateToken, updateThemeMode, updateRedApiKey } = useSettings();
  const { albums } = useCollection();
  const [aboutVisible, setAboutVisible] = useState(false);

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
          onPress={() => setAboutVisible(true)}
        />
        <List.Item
          title="Collection size"
          description={`${albums.length} release${albums.length !== 1 ? 's' : ''}`}
          left={(props) => <List.Icon {...props} icon="album" />}
        />
      </List.Section>

      <Portal>
        <Dialog visible={aboutVisible} onDismiss={() => setAboutVisible(false)}>
          <View style={styles.dialogIcon}>
            <Image source={appIcon} style={styles.appIcon} />
          </View>
          <Dialog.Title style={styles.dialogTitle}>Scout</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              Version {appVersion}
            </Text>
            <Text variant="bodyMedium" style={styles.dialogText}>
              Made with love by&nbsp;
              <Text 
                onPress={() => Linking.openURL('https://redacted.sh/user.php?action=search&search=froggo')}
                style={{
                  color: theme.colors.primary
                }}
              >froggo</Text>.{'\n\n'}
              Report bugs (yum!) and request features on&nbsp;
              <Text 
                onPress={() => Linking.openURL('https://github.com/frog-tools/Scout')}
                style={{
                  color: theme.colors.primary
                }}
              >GitHub.</Text>
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAboutVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  dialogTitle: {
    textAlign: 'center',
  },
  dialogIcon: {
    alignItems: 'center',
    marginTop: 24,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  dialogText: {
    textAlign: 'center',
  },
});
