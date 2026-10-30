import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import type { Album } from '../types';
import { loadCollection, saveCollection } from '../services/storage';

type Action =
  | { type: 'SET_ALBUMS'; payload: Album[] }
  | { type: 'ADD_ALBUM'; payload: Album }
  | { type: 'APPEND_ALBUMS'; payload: Album[] }
  | { type: 'REMOVE_ALBUMS'; payload: string[] }
  | { type: 'REORDER'; payload: { from: number; to: number } }
  | { type: 'UPDATE_ALBUM'; payload: { id: string; changes: Partial<Album> } };

interface CollectionContextValue {
  albums: Album[];
  isLoading: boolean;
  addAlbum: (album: Album) => void;
  importAlbums: (albums: Album[]) => number;
  removeAlbums: (ids: string[]) => void;
  reorder: (from: number, to: number) => void;
  updateAlbum: (id: string, changes: Partial<Album>) => void;
  hasBarcode: (barcode: string) => boolean;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

function reducer(state: Album[], action: Action): Album[] {
  switch (action.type) {
    case 'SET_ALBUMS':
      return action.payload;
    case 'ADD_ALBUM':
      return [action.payload, ...state];
    case 'APPEND_ALBUMS':
      return [...state, ...action.payload];
    case 'REMOVE_ALBUMS': {
      const ids = new Set(action.payload);
      return state.filter((a) => !ids.has(a.id));
    }
    case 'REORDER': {
      const result = [...state];
      const [item] = result.splice(action.payload.from, 1);
      result.splice(action.payload.to, 0, item);
      return result;
    }
    case 'UPDATE_ALBUM':
      return state.map((a) =>
        a.id === action.payload.id ? { ...a, ...action.payload.changes } : a,
      );
  }
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [albums, dispatch] = useReducer(reducer, []);
  const [isLoading, setIsLoading] = React.useState(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    loadCollection().then((data) => {
      dispatch({ type: 'SET_ALBUMS', payload: data });
      setIsLoading(false);
      initialized.current = true;
    });
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveCollection(albums);
    }, 300);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [albums]);

  const addAlbum = useCallback((album: Album) => {
    dispatch({ type: 'ADD_ALBUM', payload: album });
  }, []);

  // Skips releases already in the collection, matching the scan duplicate check
  const importAlbums = useCallback((imported: Album[]) => {
    const ids = new Set(albums.map((a) => a.id));
    const barcodes = new Set(albums.map((a) => a.barcode));
    const added = imported.filter((a) => {
      if (ids.has(a.id) || barcodes.has(a.barcode)) return false;
      ids.add(a.id);
      barcodes.add(a.barcode);
      return true;
    });
    dispatch({ type: 'APPEND_ALBUMS', payload: added });
    return added.length;
  }, [albums]);

  const removeAlbums = useCallback((ids: string[]) => {
    dispatch({ type: 'REMOVE_ALBUMS', payload: ids });
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    dispatch({ type: 'REORDER', payload: { from, to } });
  }, []);

  const updateAlbum = useCallback((id: string, changes: Partial<Album>) => {
    dispatch({ type: 'UPDATE_ALBUM', payload: { id, changes } });
  }, []);

  const hasBarcode = useCallback(
    (barcode: string) => albums.some((a) => a.barcode === barcode),
    [albums],
  );

  return (
    <CollectionContext.Provider
      value={{ albums, isLoading, addAlbum, importAlbums, removeAlbums, reorder, updateAlbum, hasBarcode }}
    >
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used within CollectionProvider');
  return ctx;
}
