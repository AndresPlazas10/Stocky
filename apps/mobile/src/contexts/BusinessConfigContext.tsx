import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getCountryConfig, DEFAULT_COUNTRY, type CountryConfig } from '../config/countries';

export interface BusinessConfig {
  country: CountryConfig;
  timezone: string;
  locale: string;
  language: string;
  currency: string;
  currencySymbol: string;
  decimals: number;
}

const BusinessConfigContext = createContext<BusinessConfig | null>(null);

interface BusinessConfigProviderProps {
  business: {
    country_code?: string;
    timezone?: string;
    currency?: string;
  } | null;
  children: ReactNode;
}

export function BusinessConfigProvider({ business, children }: BusinessConfigProviderProps) {
  const { i18n } = useTranslation();

  const config = useMemo((): BusinessConfig => {
    const countryCode = business?.country_code || DEFAULT_COUNTRY;
    const country = getCountryConfig(countryCode);

    return {
      country,
      timezone: business?.timezone || country.timezone,
      locale: country.locale,
      language: country.language,
      currency: business?.currency || country.currency.code,
      currencySymbol: country.currency.symbol,
      decimals: country.currency.decimals,
    };
  }, [business?.country_code, business?.timezone, business?.currency]);

  useEffect(() => {
    if (config.language && i18n.language !== config.language) {
      i18n.changeLanguage(config.language);
    }
  }, [config.language, i18n]);

  return <BusinessConfigContext.Provider value={config}>{children}</BusinessConfigContext.Provider>;
}

export function useBusinessConfig(): BusinessConfig {
  const context = useContext(BusinessConfigContext);
  if (!context) {
    const country = getCountryConfig(DEFAULT_COUNTRY);
    return {
      country,
      timezone: country.timezone,
      locale: country.locale,
      language: country.language,
      currency: country.currency.code,
      currencySymbol: country.currency.symbol,
      decimals: country.currency.decimals,
    };
  }
  return context;
}
