// PURPOSE: Detailed player profile — stats, transaction history, scouting notes.
export default function PlayerProfilePage({
  params,
}: { params: Promise<{ id: string }> }) {
  return (
    <main>
      <h1>Player profile</h1>
      {/* StatTable, TransactionTimeline, ScoutingNoteEditor — Server fetch player by params.id */}
    </main>
  );
}
