import { useState, useEffect, useCallback, useRef } from 'react';
import { Quote } from 'lucide-react';

type Testimonial = {
  text: string;
  name: string;
  role: string;
  avatar?: string;
};

type TestimonialCarouselProps = {
  testimonials: Testimonial[];
  className?: string;
};

export function TestimonialCarousel({ testimonials, className = '' }: TestimonialCarouselProps) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 4000);
  }, [testimonials.length]);

  useEffect(() => {
    if (!isPaused) startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, startAutoPlay]);

  useEffect(() => {
    setActive(0);
  }, [testimonials.length]);

  if (testimonials.length === 0) return null;

  const current = testimonials[active];

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white p-6 sm:p-8">
        <div className="mb-5 text-primary-200">
          <Quote className="h-8 w-8" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {current.text}
        </p>
        <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-400 text-sm font-semibold text-white">
            {current.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-900">{current.name}</p>
            <p className="text-xs text-muted-foreground">{current.role}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => { setActive(i); setIsPaused(true); setTimeout(() => setIsPaused(false), 3000); }}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === active ? 'w-6 bg-primary-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
