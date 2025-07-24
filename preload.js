const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'electronAPI', {
    send: (channel, data) => {
      let validChannels = ['toMain'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: async (channel, ...args) => {
      let validInvokeChannels = [
        'perform-action',
        'scan-templates',
        'get-template-details',
        'upload-file',
        'generate-addon',
        'open-folder-dialog',
        'get-config-dropdown-options',
        'scan-component-templates',
        'get-component-template-details',
        'scan-directory-for-assets',
        'perform-final-export'
      ];
      if (validInvokeChannels.includes(channel)) {
        return await ipcRenderer.invoke(channel, ...args);
      }
      console.error(`Attempted to invoke non-whitelisted channel: ${channel}`);
      throw new Error(`Invalid invoke channel: ${channel}. Make sure it's added to validInvokeChannels in preload.js.`);
    },
    on: (channel, func) => {
      let validChannels = ['fromMain'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    }
  }
);

console.log('Preload script loaded.');
