import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

const icons = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setVisible(true);

    // Set timers to animate out and then dismiss
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out transition
    }, 3000); // 3-second visibility

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`flex items-center bg-white shadow-lg rounded-md p-4 transition-all duration-300 ease-in-out transform ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {icons[type]}
      <p className="ml-3 text-sm font-medium text-gray-800">{message}</p>
    </div>
  );
};

export default Toast;