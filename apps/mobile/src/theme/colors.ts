export const colors = {
  background_primary: '#282828',
  background_surface: '#3c3836',
  background_elevated: '#504945',
  text_primary: '#ebdbb2',
  text_body: '#d5c4a1',
  text_muted: '#a89984',
  text_bright: '#fbf1c7',
  accent: '#d65d0e',
  border: '#504945',
} as const;

export type ColorName = keyof typeof colors;
