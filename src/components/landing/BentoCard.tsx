import { type LucideIcon } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

type BentoCardProps = {
  variant?: 'small' | 'medium' | 'large' | 'wide';
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
  index?: number;
  className?: string;
  children?: React.ReactNode;
};

const variantClasses: Record<string, string> = {
  small: 'col-span-1 row-span-1',
  medium: 'col-span-1 row-span-1 md:col-span-2',
  large: 'col-span-2 row-span-2 flex flex-col justify-between',
  wide: 'col-span-2 row-span-1',
};

const paddingClasses: Record<string, string> = {
  small: 'p-5',
  medium: 'p-6',
  large: 'p-6',
  wide: 'p-5',
};

export function BentoCard({
  variant = 'small',
  icon: Icon,
  title,
  description,
  gradient,
  index = 0,
  className = '',
  children,
}: BentoCardProps) {
  const isLarge = variant === 'large';

  return (
    <ScrollReveal
      delay={index * 80}
      className={`group cursor-pointer rounded-2xl border border-gray-200 bg-white/90 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 ${variantClasses[variant]} ${className}`}
    >
      <div className={`flex flex-col h-full ${paddingClasses[variant]}`}>
        <div
          className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 group-hover:scale-110 ${
            gradient || 'bg-primary-50 text-primary-600 group-hover:bg-primary-700 group-hover:text-white'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className={isLarge ? 'mt-auto' : ''}>
          <h3 className="text-sm font-semibold text-primary-900 sm:text-base">
            {title}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        </div>

        {children}
      </div>
    </ScrollReveal>
  );
}
