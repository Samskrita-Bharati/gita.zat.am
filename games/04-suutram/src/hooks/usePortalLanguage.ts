import { useEffect, useState } from 'react';
import type { Language } from '../types/gameTypes';

const PORTAL_LANGUAGE_KEY = 'zatamLanguage';

function readLanguage(): Language {
  try {
    return localStorage.getItem(PORTAL_LANGUAGE_KEY) === 'sa' ? 'sa' : 'en';
  } catch {
    return 'en';
  }
}

export function usePortalLanguage(): Language {
  const [language, setLanguage] = useState<Language>(readLanguage);

  useEffect(() => {
    const sync = () => setLanguage(readLanguage());
    const onLanguageChange = (event: Event) => {
      const value = (event as CustomEvent<{ language?: string }>).detail?.language;
      if (value === 'en' || value === 'sa') setLanguage(value);
      else sync();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PORTAL_LANGUAGE_KEY || event.key === null) sync();
    };

    window.addEventListener('zatam:languagechange', onLanguageChange);
    window.addEventListener('storage', onStorage);
    document.addEventListener('zatam:navbarready', sync);
    sync();
    return () => {
      window.removeEventListener('zatam:languagechange', onLanguageChange);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('zatam:navbarready', sync);
    };
  }, []);

  useEffect(() => {
  const subtitle = document.querySelector('.strands-page-header p');
  if (subtitle) subtitle.textContent = language === 'sa'
    ? 'अक्षराणि संयोज्य गुप्तशब्दान् अन्वेषयतु।'
    : 'Connect Sanskrit letters to discover the hidden words.';
}, [language]);

  return language;
}
