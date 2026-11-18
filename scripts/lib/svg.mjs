export const THEMES = {
  light: { paper: '#FBFCFD', ink: '#1C2733', muted: '#5B6B7C', rule: '#DCE2E9', span: '#2E6BD6', open: '#B07200' },
  dark: { paper: '#14212F', ink: '#E6ECF2', muted: '#9AABBD', rule: '#2A3B4F', span: '#6FA0F2', open: '#F2B544' },
};

export const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

export const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const compactNumber = (value) => {
  if (value < 1000) return String(value);
  const tenths = Math.round(value / 100);
  return tenths >= 100 ? `${Math.round(value / 1000)}k` : `${(tenths / 10).toFixed(1)}k`;
};
