import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('arc2', {
  version: '0.1.0'
});
