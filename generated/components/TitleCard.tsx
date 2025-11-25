import React from 'react';

interface TitleCardProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

const TitleCard: React.FC<TitleCardProps> = ({ 
  title = 'Hello World',
  subtitle,
  className = ''
}) => {
  return (
    <div 
      className={`
        flex flex-col items-center justify-center
        p-8 md:p-12 lg:p-16
        bg-gradient-to-br from-blue-500 to-purple-600
        rounded-2xl shadow-2xl
        w-full max-w-2xl mx-auto
        ${className}
      `}
      role="region"
      aria-label="Title card"
    >
      <h1 
        className="
          text-4xl md:text-5xl lg:text-6xl
          font-bold text-white
          text-center mb-2
          drop-shadow-lg
          animate-fade-in
        "
      >
        {title}
      </h1>
      {subtitle && (
        <p 
          className="
            text-lg md:text-xl
            text-white/90
            text-center mt-4
            font-light
          "
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default TitleCard;