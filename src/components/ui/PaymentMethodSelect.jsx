import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  getPaymentMethodLabel,
  getPaymentMethodLogoCandidates,
  isBankPaymentMethod
} from '../../utils/paymentMethodBranding.js';

const BASE_OPTIONS = [
  { value: 'cash', emoji: '💵' },
  { value: 'card', emoji: '💳' },
  { value: 'transfer', emoji: '🏦' },
  { value: 'mixed', emoji: '🔀' },
  { value: 'nequi', emoji: '🏦' },
  { value: 'bancolombia', emoji: '🏦' },
  { value: 'banco_bogota', emoji: '🏦' },
  { value: 'nu', emoji: '🏦' },
  { value: 'davivienda', emoji: '🏦' }
];

function BankLogo({ method, sizeClass = 'h-4' }) {
  const [index, setIndex] = useState(0);
  const candidates = getPaymentMethodLogoCandidates(method);

  useEffect(() => {
    setIndex(0);
  }, [method]);

  if (!isBankPaymentMethod(method)) return null;
  if (!Array.isArray(candidates) || candidates.length === 0 || index < 0) {
    return <span className="text-sm">🏦</span>;
  }

  const src = candidates[index];

  return (
    <img
      src={src}
      alt={`Logo ${getPaymentMethodLabel(method)}`}
      className={`${sizeClass} w-auto object-contain`}
      loading="lazy"
      onError={() => {
        setIndex((current) => (current + 1 < candidates.length ? current + 1 : -1));
      }}
    />
  );
}

export default function PaymentMethodSelect({
  value,
  onChange,
  includeMixed = true,
  className = '',
  menuClassName = ''
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const options = useMemo(() => {
    if (includeMixed) return BASE_OPTIONS;
    return BASE_OPTIONS.filter((option) => option.value !== 'mixed');
  }, [includeMixed]);

  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-white flex items-center justify-between"
      >
        <span className="flex items-center gap-2 min-w-0">
          {isBankPaymentMethod(selected?.value) ? (
            <BankLogo method={selected.value} sizeClass="h-5" />
          ) : (
            <span className="text-sm">{selected?.emoji || '💳'}</span>
          )}
          <span className="truncate text-sm font-medium text-primary-900">
            {getPaymentMethodLabel(selected?.value)}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-primary-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute z-40 mt-2 w-full rounded-xl border border-accent-200 bg-white shadow-lg overflow-hidden ${menuClassName}`}>
          {options.map((option) => {
            const isSelected = option.value === selected?.value;

            return (
              <button
                key={option.value}
                type="button"
                className={`w-full h-10 px-3 flex items-center gap-2 text-left hover:bg-accent-50 ${isSelected ? 'bg-accent-50' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {isBankPaymentMethod(option.value) ? (
                  <BankLogo method={option.value} sizeClass="h-4" />
                ) : (
                  <span className="text-sm">{option.emoji}</span>
                )}
                <span className="text-sm text-primary-900">
                  {getPaymentMethodLabel(option.value)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
