import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'rrweb-player/dist/style.css';
import './styles.less';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);