import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { isNativeApp } from '@/lib/platform';

export const useBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNativeApp()) return;

    const handleBackButton = App.addListener('backButton', ({ canGoBack }) => {
      // If we're at root paths, minimize the app instead of navigating
      const rootPaths = ['/', '/pos', '/admin', '/dashboard', '/discover'];
      
      if (rootPaths.includes(location.pathname)) {
        App.minimizeApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        // Fallback to POS for staff
        navigate('/pos');
      }
    });

    return () => {
      handleBackButton.then(listener => listener.remove());
    };
  }, [navigate, location.pathname]);
};
