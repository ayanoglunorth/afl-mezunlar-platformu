'use client';

import { useState } from 'react';

export const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  id,
  allowOther = false,
}: { 
  options: string[], 
  value: string, 
  onChange: (v: string) => void, 
  placeholder: string, 
  id: string,
  allowOther?: boolean,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const allOptions = allowOther ? [...options, '__other_university__'] : options;
  const filteredOptions = query === ''
    ? allOptions
    : allOptions.filter(option => option === '__other_university__' || option.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')));

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        className="input"
        placeholder={placeholder}
        value={isOpen ? query : value}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          onChange(''); // clear selected value when typing
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
            if (!value) setQuery(''); // Reset query if nothing selected
          }, 200);
        }}
        required
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option) => (
            <li
              key={option}
              className="px-4 py-2 hover:bg-surface-50 cursor-pointer text-sm text-surface-700"
              onClick={() => {
                onChange(option);
                setQuery('');
                setIsOpen(false);
              }}
            >
              {option === '__other_university__' ? 'Diğer' : option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
