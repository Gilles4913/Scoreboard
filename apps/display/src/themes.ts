export type ThemeName = 'classic' | 'neon' | 'glass';
export function applyTheme(name: ThemeName){
  const r = document.documentElement;
  if (name === 'classic'){
    r.style.setProperty('--bg', '#000');
    r.style.setProperty('--panel', '#0a0a0a');
    r.style.setProperty('--panel2', '#0f0f0f');
    r.style.setProperty('--led', '#00ffd0');
    r.style.setProperty('--led-dim', '#00ffd055');
    r.style.setProperty('--text', '#eaeaea');
    r.style.setProperty('--chip-bg', '#121212');
    r.style.setProperty('--chip-border', '#1c1c1c');
  } else if (name === 'neon'){
    r.style.setProperty('--bg', '#06070d');
    r.style.setProperty('--panel', '#0a0f1d');
    r.style.setProperty('--panel2', '#0d1326');
    r.style.setProperty('--led', '#36ffb5');
    r.style.setProperty('--led-dim', '#36ffb580');
    r.style.setProperty('--text', '#eaf6ff');
    r.style.setProperty('--chip-bg', 'rgba(8,12,20,.7)');
    r.style.setProperty('--chip-border', '#1b2434');
  } else if (name === 'glass'){
    r.style.setProperty('--bg', '#04060a');
    r.style.setProperty('--panel', '#0b0e14');
    r.style.setProperty('--panel2', '#0f1320');
    r.style.setProperty('--led', '#8ef7ff');
    r.style.setProperty('--led-dim', '#8ef7ff80');
    r.style.setProperty('--text', '#ecf2ff');
    r.style.setProperty('--chip-bg', 'rgba(10,12,18,.55)');
    r.style.setProperty('--chip-border', '#1c2332');
  }
}
