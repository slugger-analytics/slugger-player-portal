// PURPOSE: Client-side Favorites list: draggable rows. Uses usePriorityList for state/mutations.
// TODO: Connect to API for persisted priority list; drag-and-drop reorder.
"use client";

import { DraggablePlayerRow } from "./DraggablePlayerRow";

/** Placeholder data until backend is connected. */
const MOCK_ENTRIES = [
  { id: "1", name: "Info Info Info Info Info", subtitle: "Position · Team", rank: 1 },
  { id: "2", name: "Info Info Info Info Info", subtitle: "Position · Team", rank: 2 },
  { id: "3", name: "Info Info Info Info Info", subtitle: "Position · Team", rank: 3 },
];

export function PriorityListContent() {
  return (
    <ul className="space-y-2" role="list" aria-label="Favorites list">
      {MOCK_ENTRIES.map((entry) => (
        <li key={entry.id}>
          <DraggablePlayerRow
            id={entry.id}
            name={entry.name}
            subtitle={entry.subtitle}
            rank={entry.rank}
          />
        </li>
      ))}
    </ul>
  );
}
