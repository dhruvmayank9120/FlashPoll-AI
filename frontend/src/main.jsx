import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.jsx'
import './index.css'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: '#6366f1' },
    secondary: { main: '#8b5cf6' },
    background:{ default: '#060608', paper: '#0d0d12' },
    text:      { primary: '#e2e2f0', secondary: '#6b6b8a' },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  components: {
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.5px' }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, height: 4 },
        bar:  { borderRadius: 99 },
      }
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
