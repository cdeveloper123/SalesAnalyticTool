import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import AnalyzeDeal from './pages/AnalyzeDeal';

function App() {
  const API_BASE_URL = import.meta.env.VITE_REACT_BACKEND_URL || 'http://localhost:3001';
  console.log(API_BASE_URL,"API_URL");
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analyze" element={<AnalyzeDeal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

