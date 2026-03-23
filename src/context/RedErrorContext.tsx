import React, { createContext, useContext, useState, useCallback } from 'react';
import { Dialog, Button, Text } from 'react-native-paper';

interface RedErrorContextValue {
  showRedError: (messageTitle: string, message: string) => void;
}

const RedErrorContext = createContext<RedErrorContextValue>({
  showRedError: () => {},
});

export function useRedError() {
  return useContext(RedErrorContext);
}

export function RedErrorProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showRedError = useCallback((messageTitle: string, message: string) => {
    setTitle(messageTitle);
    setError(message);
  }, []);

  return (
    <RedErrorContext.Provider value={{ showRedError }}>
      {children}
      <Dialog visible={!!error} onDismiss={() => setError(null)}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{error}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setError(null)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </RedErrorContext.Provider>
  );
}
