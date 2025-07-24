// __mocks__/electron.js

// Mock the parts of Electron that main.js might try to access at a module level.
// For scanWeaponTemplatesLogic, it doesn't directly use these, but main.js requires them.
module.exports = {
  app: {
    on: jest.fn(),
    getPath: jest.fn((name) => {
      if (name === 'userData') return '/mock/appdata'; // Mock common paths if needed
      return '/mock/path';
    }),
    isReady: jest.fn(() => true),
    // Add other app properties/methods if your main.js accesses them globally
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      send: jest.fn(),
    },
    on: jest.fn(),
    destroy: jest.fn(),
    // Add other BrowserWindow methods/properties
  })),
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
    removeHandler: jest.fn(),
    // Add other ipcMain methods/properties
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(() => ({
        items: [],
    })),
  },
  shell: {
    openExternal: jest.fn(),
  },
  // Add any other Electron modules that are required at the top level of main.js
};
