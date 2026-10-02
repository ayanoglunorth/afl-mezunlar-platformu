'use client';

import { useState, useEffect } from 'react';

export const CompanyAutocomplete = ({ 
  value, 
  logo,
  onChange 
}: { 
  value: string, 
  logo: string,
  onChange: (name: string, logo: string) => void 
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{name: string, domain: string, logo: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  const [inputLogoError, setInputLogoError] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputLogoError(false);
  }, [logo]);

  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Clearbit API error', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, value]);

  return (
    <div className="relative">
      <div className="relative">
        {logo && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded overflow-hidden bg-brand-500/10 flex items-center justify-center text-brand-500 text-xs font-bold">
            {!inputLogoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={logo} 
                alt="" 
                className="w-full h-full object-contain bg-white" 
                onError={() => setInputLogoError(true)} 
              />
            ) : (
              <span>{query.charAt(0)}</span>
            )}
          </div>
        )}
        <input
          type="text"
          className={`input ${logo ? 'pl-11' : ''}`}
          placeholder="Örn: Google, Aselsan, Trendyol..."
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            setIsOpen(true);
            onChange(nextValue, '');
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          required
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-surface-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((company) => {
            const logoUrl = company.logo || `https://logo.debounce.com/${company.domain}`;
            return (
              <li
                key={company.domain}
                className="px-4 py-2 hover:bg-surface-50 cursor-pointer flex items-center gap-3"
                onClick={() => {
                  setQuery(company.name);
                  onChange(company.name, logoUrl);
                  setIsOpen(false);
                }}
              >
                <div className="w-6 h-6 rounded flex-shrink-0 bg-brand-500/10 flex items-center justify-center text-brand-500 text-xs font-bold overflow-hidden">
                  {!imageError[company.domain] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={logoUrl} 
                      alt="" 
                      className="w-full h-full object-contain bg-white" 
                      onError={() => setImageError(prev => ({ ...prev, [company.domain]: true }))}
                    />
                  ) : (
                    <span>{company.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-surface-900">{company.name}</div>
                  <div className="text-xs text-surface-500">{company.domain}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

