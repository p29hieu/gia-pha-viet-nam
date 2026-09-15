import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Không tìm thấy phần tử #root');

// Cong cu chuyen du lieu mot lan, chi co khi chay may phat trien.
if (import.meta.env.DEV) {
  void (async () => {
    const [{ importBackup }, { backfillUid }, client] = await Promise.all([
      import('./api/importBackup'),
      import('./api/backfillUid'),
      import('./api/client'),
    ]);
    const w = window as unknown as Record<string, unknown>;
    w.__giaphaImport = importBackup;
    w.__giaphaBackfillUid = backfillUid;
    w.__giaphaClient = client;
  })();
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
