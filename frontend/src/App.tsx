import { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data.status ?? 'unknown'))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Dynamic Form</h1>
      <p>React + Vite + TypeScript frontend.</p>
      <p>
        Backend health: <strong>{health}</strong>
      </p>
    </main>
  );
}

export default App;
