import { alpha, createTheme } from '@mui/material/styles';

const indigo = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
};

const border = '#e5e7eb';

export const theme = createTheme({
  palette: {
    primary: { main: indigo[600], dark: indigo[700], light: indigo[500], contrastText: '#fff' },
    secondary: { main: '#0f766e' },
    success: { main: '#15803d' },
    warning: { main: '#b45309' },
    error: { main: '#b91c1c' },
    background: { default: '#f7f8fb', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#4b5563' },
    divider: border,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter Variable", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.4rem', fontWeight: 650 },
    h4: { fontSize: '1.2rem', fontWeight: 650 },
    h5: { fontSize: '1.05rem', fontWeight: 650 },
    h6: { fontSize: '0.95rem', fontWeight: 650 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: border } },
    },
    MuiPaper: {
      styleOverrides: { outlined: { borderColor: border } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.92),
          backdropFilter: 'blur(8px)',
          color: '#111827',
          borderBottom: `1px solid ${border}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { borderRight: `1px solid ${border}` } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiTableCell: {
      styleOverrides: { head: { fontWeight: 600, color: '#374151', backgroundColor: '#f9fafb' } },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
    },
  },
});
