import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  // Render a beautiful, friendly cozy cartoon instruction panel if Clerk key is missing.
  // This prevents blank-screen runtime crashes and guides the user/recruiter on setup.
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <div style={{
        fontFamily: 'Nunito, system-ui, sans-serif',
        padding: '40px 32px',
        maxWidth: 540,
        margin: '80px auto',
        background: '#FFF6E6',
        border: '4px solid #2B1E16',
        borderRadius: '36px',
        boxShadow: '0 8px 0 #2B1E16',
        color: '#3B2A1F',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12, letterSpacing: '-0.01em' }}>Clerk API Key Required</h2>
        <p style={{ fontWeight: 700, lineHeight: 1.5, color: '#6B4F3F', fontSize: 16 }}>
          PhysioAlign now supports Google Sign-In using Clerk. To start, please provide your Clerk Publishable Key in the local configuration.
        </p>
        
        <div style={{
          background: 'white',
          border: '3px solid #2B1E16',
          borderRadius: '22px',
          padding: '20px 22px',
          margin: '24px 0',
          textAlign: 'left',
          fontSize: 14,
          fontWeight: 800,
          lineHeight: 1.6,
          boxShadow: '0 4px 0 #2B1E16'
        }}>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>Go to <a href="https://clerk.com" target="_blank" rel="noreferrer" style={{ color: '#FF8E5C', textDecoration: 'underline' }}>clerk.com</a> and sign up for a free developer account.</li>
            <li style={{ marginBottom: 8 }}>Create a new application and select <b>Google</b> as the sign-in provider.</li>
            <li style={{ marginBottom: 8 }}>Copy your <b>Publishable Key</b> from the Clerk Dashboard.</li>
            <li style={{ marginBottom: 0 }}>Open your local file <code style={{ background: '#FFF6E6', padding: '2px 6px', borderRadius: 4 }}>.env</code> and add:
              <code style={{ display: 'block', background: '#FFF6E6', padding: '10px', marginTop: 10, border: '2px solid #2B1E16', borderRadius: 8, fontSize: 12 }}>
                VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
              </code>
            </li>
          </ol>
        </div>
        
        <p style={{ fontSize: 13, color: '#8E7261', fontWeight: 800, margin: 0 }}>
          Save the file and refresh this page to begin your practice!
        </p>
      </div>
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </React.StrictMode>
  );
}
