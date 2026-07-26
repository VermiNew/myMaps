import React from 'react';
import ReactDOM from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import App from './App';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';

(window as any).maplibregl = maplibregl;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
