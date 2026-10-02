'use client';

import { useState } from 'react';

export const MultiSearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  id, 
  maxSelections 
}: { 
  options: string[], 
  value: string[], 
  onChange: (v: string[]) => void, 
  placeholder: string, 
  id: string, 
  maxSelections?: number 
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = query === ''
    ? options.filter(o => !value.includes(o))
    : options.filter(o => !value.includes(o) && o.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')));

  const handleSelect = (option: string) => {
    if (maxSelections && value.length >= maxSelections) return;
    onChange([...value, option]);
    setQuery('');
    setIsOpen(false);
  };

  const handleRemove = (option: string) => {
    onChange(value.filter(v => v !== option));
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(selected => (
          <div key={selected} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-sm font-medium animate-in fade-in zoom-in duration-200">
            {selected}
            <button
              type="button"
              onClick={() => handleRemove(selected)}
              className="cursor-pointer p-0.5 rounded-md transition-colors hover:bg-brand-100"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      
      <div className="relative">
        <input
          id={id}
          type="text"
          className="input pr-10"
          placeholder={maxSelections && value.length >= maxSelections ? 'Maksimum seçime ulaşıldı' : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          disabled={!!maxSelections && value.length >= maxSelections}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option) => (
            <li
              key={option}
              className="px-4 py-2 hover:bg-surface-50 cursor-pointer text-sm text-surface-700 transition-colors"
              onClick={() => handleSelect(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
