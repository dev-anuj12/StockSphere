import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { Search, Loader2 } from 'lucide-react';

export function ProductAutocomplete({ onSelect, selectedProduct, placeholder = 'Search by product name or SKU...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (selectedProduct) {
      setQuery(`${selectedProduct.name} (${selectedProduct.sku})`);
    } else {
      setQuery('');
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (!query || (selectedProduct && query === `${selectedProduct.name} (${selectedProduct.sku})`)) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/products/autocomplete?q=${encodeURIComponent(query)}`);
        setResults(res.data.data || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, selectedProduct]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = e => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = prod => {
    setQuery(`${prod.name} (${prod.sku})`);
    setIsOpen(false);
    onSelect(prod);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (selectedProduct) onSelect(null);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
        {loading && (
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin absolute right-3.5 top-3.5" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-30 w-full mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {results.map((prod, idx) => (
            <div
              key={prod.id}
              onClick={() => handleSelect(prod)}
              className={`p-3 text-sm cursor-pointer border-b border-slate-50 flex items-center justify-between transition ${
                idx === selectedIndex ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div>
                <span className="font-semibold text-slate-900">{prod.name}</span>
                <span className="ml-2 font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {prod.sku}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium">Stock: </span>
                <span className={`font-semibold text-xs ${prod.total_stock <= prod.reorder_level ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {prod.total_stock} {prod.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
