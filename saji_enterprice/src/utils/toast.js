import toast from 'react-hot-toast';

// Custom toast configuration with modern styling
const toastConfig = {
  success: {
    duration: 3000,
    style: {
      background: '#10b981',
      color: '#fff',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '10px',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981',
    },
  },
  error: {
    duration: 4000,
    style: {
      background: '#ef4444',
      color: '#fff',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '10px',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444',
    },
  },
  warning: {
    duration: 3500,
    style: {
      background: '#f59e0b',
      color: '#fff',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '10px',
    },
    icon: '⚠️',
  },
  info: {
    duration: 3000,
    style: {
      background: '#3b82f6',
      color: '#fff',
      fontWeight: '500',
      padding: '16px',
      borderRadius: '10px',
    },
    icon: 'ℹ️',
  },
};

// Enhanced toast functions
export const showToast = {
  success: (message) => toast.success(message, toastConfig.success),
  error: (message) => toast.error(message, toastConfig.error),
  warning: (message) => toast(message, toastConfig.warning),
  info: (message) => toast(message, toastConfig.info),
  loading: (message) => toast.loading(message),
  promise: (promise, messages) => toast.promise(promise, messages),
};

export default showToast;
