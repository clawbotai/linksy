import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { WebAppShell } from "@/components/WebAppShell";
import { DesktopHomePage } from "@/pages/DesktopHomePage";
import { WebPodcastPage } from "@/pages/WebPodcastPage";
import { DesktopTranscriptionsPage } from "@/pages/DesktopTranscriptionsPage";
import { WebTranscriptionDetailPage } from "@/pages/WebTranscriptionDetailPage";
import { WebSettingsPage } from "@/pages/WebSettingsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <WebAppShell />,
    children: [
      { index: true, element: <DesktopHomePage /> },
      { path: "podcast", element: <WebPodcastPage /> },
      { path: "transcriptions", element: <DesktopTranscriptionsPage /> },
      { path: "transcriptions/:id", element: <WebTranscriptionDetailPage /> },
      { path: "settings", element: <WebSettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
