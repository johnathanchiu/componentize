import React, { useState } from 'react';

interface ButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  className = '', 
  variant = 'primary',
  size = 'md'
}) => {
  const [message, setMessage] = useState('');

  const handleClick = () => {
    setMessage('Hello World');
    // Optional: Clear message after 3 seconds
    setTimeout(() => setMessage(''), 3000);
  };

  const baseStyles = 'font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        aria-label="Click to say hello world"
        type="button"
      >
        Click Me
      </button>
      
      {message && (
        <div 
          className="text-2xl font-bold text-gray-800 animate-bounce"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default Button;