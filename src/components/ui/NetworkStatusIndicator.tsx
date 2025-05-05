import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

const NetworkStatusIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Network connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Network connection lost. Some features may be unavailable.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null; // Don't show anything when online
  }

  return (
    <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-50">
      <WifiOff size={18} className="mr-2" />
      <span>Offline Mode</span>
    </div>
  );
};

export default NetworkStatusIndicator;