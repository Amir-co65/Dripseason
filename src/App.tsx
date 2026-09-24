import { AppRouter } from "@/routes/router";
import { RealtimeSync } from "@/components/RealtimeSync";
import { Project26UiSync } from "@/components/Project26UiSync";

export default function App() {
  return <><Project26UiSync /><RealtimeSync /><AppRouter /></>;
}
