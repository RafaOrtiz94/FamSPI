import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#004aad" },
    secondary: { main: "#00bfa6" },
    background: { default: "#f4f6f8", paper: "#ffffff" },
  },
  typography: {
    fontFamily: "Poppins, Roboto, sans-serif",
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
});

export default theme;
