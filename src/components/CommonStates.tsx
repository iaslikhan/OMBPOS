import React from 'react';
import { AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading database records...',
}) => {
  return (
    <div id="loading-state-container" className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin mb-4" />
      <p className="text-sm text-gray-300 font-medium">{message}</p>
      <span className="text-xs text-gray-500 mt-1">Connecting to Room Database Engine</span>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Database Error',
  message,
  onRetry,
}) => {
  return (
    <div id="error-state-container" className="p-6 max-w-md mx-auto my-8 bg-red-950/30 border border-red-800/50 rounded-2xl text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-red-900/40 text-red-400 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-red-200 mb-4">{message}</p>
      {onRetry && (
        <button
          id="btn-error-retry"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Operation
        </button>
      )}
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div id="empty-state-container" className="flex flex-col items-center justify-center p-8 text-center bg-[#1A1A22] border border-[#2D2D3B] rounded-2xl my-4">
      <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center mb-3">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
      <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          id="btn-empty-state-action"
          onClick={onAction}
          className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold text-xs hover:bg-orange-400 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
