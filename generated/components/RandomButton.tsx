import React, { useState } from 'react';

interface RandomButtonProps {
  className?: string;
}

const RandomButton: React.FC<RandomButtonProps> = ({ className = '' }) => {
  const [message, setMessage] = useState('');

  const handleClick = () => {
    setMessage('Hi! 👋');
    // Optional: Clear message after 2 seconds
    setTimeout(() => {
      setMessage('');
    }, 2000);
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <button
        onClick={handleClick}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300"
        aria-label="Click to say hi"
        type="button"
      >
        Click Me!
      </button>
      
      {message && (
        <div
          className="text-2xl font-bold text-gray-800 animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default RandomButton;