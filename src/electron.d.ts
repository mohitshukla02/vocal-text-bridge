export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: true;
      pickFolder: () => Promise<string | null>;
    };
  }
}
