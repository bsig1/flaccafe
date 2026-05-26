import { AppView } from "./AppView";
import { useAppController } from "./AppController";
import { MiniPlayerWindow } from "./player/MiniPlayerWindow";

export default function App() {
  if (new URLSearchParams(window.location.search).get("miniPlayer") === "1") {
    return <MiniPlayerWindow />;
  }

  const controller = useAppController();

  return <AppView controller={controller} />;
}
