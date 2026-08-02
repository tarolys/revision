import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Practice } from "./pages/Practice";
import { ReviewPrac } from "./pages/ReviewPrac";
import { Import } from "./pages/Import";
import { DocumentGeneration } from "./pages/DocumentGeneration";
import { getMeta } from "./lib/db/schema";
import type { SubjectSlug } from "./lib/types";
import type { View } from "./lib/navigation";
import styles from "./App.module.css";

function App() {
  const [round, setRound] = useState(1);
  const [subject, setSubject] = useState<SubjectSlug>("maths");
  const [view, setView] = useState<View>("dashboard");

  async function refreshRound() {
    const meta = await getMeta();
    setRound(meta.currentRound);
  }

  useEffect(() => {
    void refreshRound();
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar
        round={round}
        subject={subject}
        onSubjectChange={setSubject}
        view={view}
        onViewChange={setView}
      />
      <main className={styles.main}>
        {view === "dashboard" && <Dashboard subject={subject} round={round} />}
        {view === "practice" && <Practice subject={subject} round={round} />}
        {view === "reviewPrac" && <ReviewPrac subject={subject} round={round} />}
        {view === "import" && (
          <Import onImported={() => void refreshRound()} onDone={() => setView("dashboard")} />
        )}
        {view === "documentGeneration" && <DocumentGeneration />}
      </main>
    </div>
  );
}

export default App;
