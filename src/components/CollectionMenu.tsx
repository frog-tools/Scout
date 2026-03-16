import React, { useState } from 'react';
import { Appbar, Menu } from 'react-native-paper';

interface Props {
  onSelectAll: () => void;
  onSelectNotOnRed: () => void;
  onSelectNoRedStatus: () => void;
  hasRedApiKey: boolean;
  hasAlbums: boolean;
}

export default function CollectionMenu({
  onSelectAll,
  onSelectNotOnRed,
  onSelectNoRedStatus,
  hasRedApiKey,
  hasAlbums,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      contentStyle={{ minWidth: 300 }}
      anchor={
        <Appbar.Action icon="dots-vertical" onPress={() => setVisible(true)} disabled={!hasAlbums} />
      }
    >
      <Menu.Item
        leadingIcon="select-all"
        onPress={() => { onSelectAll(); setVisible(false); }}
        title="Select all"
      />
      {hasRedApiKey && (
        <>
          <Menu.Item
            leadingIcon="party-popper"
            onPress={() => { onSelectNotOnRed(); setVisible(false); }}
            title="Select items not on RED"
          />
          <Menu.Item
            leadingIcon="help-circle-outline"
            onPress={() => { onSelectNoRedStatus(); setVisible(false); }}
            title="Select items missing RED data"
          />
        </>
      )}
    </Menu>
  );
}
