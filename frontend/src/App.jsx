import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ReportIssuePage from './pages/ReportIssuePage';
import RequestSuccessPage from './pages/RequestSuccessPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Report an Issue Page */}
          <Route path="/report" element={<ReportIssuePage />} />

          {/* Dedicated Request Submitted Success Page */}
          <Route path="/report/success/:requestId" element={<RequestSuccessPage />} />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
