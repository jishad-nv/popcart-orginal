import React from 'react';

interface PopcartyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  iconOnly?: boolean;
}

export const PopcartyLogo: React.FC<PopcartyLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = '',
  iconOnly = false,
}) => {
  // Dimensions refined for a clean, neat and balanced presence
  const iconDimensions = {
    sm: { width: 20, height: 22 },
    md: { width: 24, height: 26 },
    lg: { width: 32, height: 34 },
    xl: { width: 42, height: 46 },
  }[size];

  const textSizes = {
    sm: 'text-sm sm:text-base font-bold',
    md: 'text-base sm:text-lg font-extrabold',
    lg: 'text-xl sm:text-2xl font-black',
    xl: 'text-2xl sm:text-3xl font-black',
  }[size];

  const subSizes = {
    sm: 'text-[6px] sm:text-[6.5px] tracking-[0.16em]',
    md: 'text-[7px] tracking-[0.18em]',
    lg: 'text-[8.5px] tracking-[0.2em]',
    xl: 'text-[10px] tracking-[0.24em]',
  }[size];

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
      {/* Precision Vector SVG Shopping Bag with Pointer Icon */}
      <svg
        width={iconDimensions.width}
        height={iconDimensions.height}
        viewBox="0 0 100 106"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform group-hover:scale-105 duration-200"
      >
        {/* Rounded Bag Handle */}
        <path
          d="M32 36V22C32 12.0589 40.0589 4 50 4C59.9411 4 68 12.0589 68 22V36"
          stroke="#7152E8"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Shopping Bag Solid Body */}
        <rect
          x="4"
          y="28"
          width="92"
          height="74"
          rx="22"
          fill="#7152E8"
        />

        {/* Crisp Center Pointer / Cursor Arrowhead */}
        <path
          d="M28 44.5C27.1 43.2 28.2 41.5 29.8 41.8L72.2 48.9C73.9 49.2 74.4 51.3 73.1 52.3L54.6 66.8C53.9 67.4 53.4 68.3 53.3 69.2L50.5 86.8C50.2 88.6 47.9 89.2 46.8 87.7L28 44.5Z"
          fill="white"
        />
      </svg>

      {!iconOnly && (
        <div className="flex flex-col justify-center">
          {/* Two-tone typography: 'Pop' in Purple + 'carty' in Warm Caramel Sand */}
          <div className={`font-display leading-none tracking-tight flex items-baseline ${textSizes}`}>
            <span className="text-[#7152E8]">Pop</span>
            <span className="text-[#D49B60]">carty</span>
          </div>

          {/* Subtitle with gold dot separator */}
          {showSubtitle && (
            <div className={`font-bold font-sans uppercase text-[#7152E8] flex items-center gap-1 mt-0.5 opacity-85 leading-none ${subSizes}`}>
              <span>TRENDING PRODUCTS</span>
              <span className="text-[#D49B60] text-[10px] leading-none">·</span>
              <span>BETTER LIVING</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
