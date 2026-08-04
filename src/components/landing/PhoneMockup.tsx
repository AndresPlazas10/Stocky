import { useState, useEffect, useCallback } from 'react';

type PhoneMockupProps = {
  screenshots: string[];
  className?: string;
};

export function PhoneMockup({ screenshots = [], className = '' }: PhoneMockupProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % Math.max(screenshots.length, 1));
  }, [screenshots.length]);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [screenshots.length, next]);

  return (
    <div className={`relative mx-auto w-[240px] sm:w-[260px] ${className}`}>
      <div className="animate-float">
        <div className="relative rounded-[40px] border-[6px] border-gray-800 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-[100px] h-[22px] bg-gray-800 rounded-b-2xl" />

          <div className="relative w-full h-full bg-white overflow-hidden">
            {screenshots.length > 0 ? (
              screenshots.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`Screenshot ${i + 1}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
                  style={{ opacity: i === activeIndex ? 1 : 0 }}
                />
              ))
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <rect x="4" y="4" width="10" height="10" rx="2" fill="white" opacity="0.9" />
                      <rect x="18" y="4" width="10" height="10" rx="2" fill="white" opacity="0.7" />
                      <rect x="4" y="18" width="10" height="10" rx="2" fill="white" opacity="0.5" />
                      <rect x="18" y="18" width="10" height="10" rx="2" fill="white" opacity="0.3" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-white">Stocky</p>
                  <p className="text-xs text-white/70 mt-1">Sistema POS</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {screenshots.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'w-5 bg-primary-600' : 'w-1.5 bg-gray-300'
                }`}
                aria-label={`Screenshot ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
