import './app/fonts';
import React from 'react';
import { createRoot } from 'react-dom/client';
import './app/styles.css';
import { App } from './app/App';
import { ExportWorker } from './app/ExportWorker';
const exporting = new URLSearchParams(location.search).has('export');
createRoot(document.getElementById('root')!).render(exporting ? <ExportWorker/> : <React.StrictMode><App /></React.StrictMode>);
