import "@fontsource-variable/dm-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "./style.css";
import "./model-guide.css";
import "./workbench.css";
export const metadata = {
  title: "Dealerstudio · Ultimate Reality",
  description: "Lokala dealerfilmer och Runway-utkast.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
