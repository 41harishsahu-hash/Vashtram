import React, { useState, useEffect } from 'react';
import { ThemeContext } from './themeContextDef';
import { storage } from '../utils/storage';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => storage.getTheme());

  useEffect(() => {
    storage.setTheme(theme);
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
