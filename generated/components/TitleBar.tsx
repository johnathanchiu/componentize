import React from 'react';

interface TitleBarProps {
  title?: string;
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'Title',
  className = ''
}) => {
  return (
    <header 
      className={`w-full bg-gray-800 text-white px-6 py-4 shadow-md ${className}`}
      role="banner"
    >
      <h1 className="text-2xl font-bold text-center md:text-left">
        {title}
      </h1>
    </header>
  );
};

export default TitleBar;