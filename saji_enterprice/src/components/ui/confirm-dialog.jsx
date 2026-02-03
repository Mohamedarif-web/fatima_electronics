import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './button';

/**
 * Reusable confirmation dialog component
 * Replace window.confirm with a better UX
 */
const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // danger, warning, info
  details = null // Array of detail strings or JSX
}) => {
  if (!isOpen) return null;

  const iconConfig = {
    danger: { Icon: Trash2, bgColor: 'bg-red-100', iconColor: 'text-red-600', btnColor: 'bg-red-600 hover:bg-red-700' },
    warning: { Icon: AlertTriangle, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600', btnColor: 'bg-yellow-600 hover:bg-yellow-700' },
    info: { Icon: AlertTriangle, bgColor: 'bg-blue-100', iconColor: 'text-blue-600', btnColor: 'bg-blue-600 hover:bg-blue-700' }
  };

  const config = iconConfig[variant] || iconConfig.danger;
  const { Icon, bgColor, iconColor, btnColor } = config;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-full ${bgColor}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Message */}
        <div className="mb-6">
          <p className="text-gray-700 mb-3">{message}</p>
          
          {/* Details */}
          {details && (
            <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              {Array.isArray(details) ? (
                <>
                  <p className="font-semibold mb-2">⚠️ This will:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </>
              ) : (
                details
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`text-white ${btnColor}`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
