import React from "react";

export default function SportsPage() {
  return (
    <div>
      <h2>Sports</h2>
      <p>SB2 : 1 organisation = 1 sport.</p>
      <ul>
        <li>football</li>
        <li>basket</li>
        <li>volleyball</li>
        <li>handball</li>
        <li>rugby</li>
      </ul>
      <p>Les réglages d’affichage sont portés par org → héritage équipes (override).</p>
    </div>
  );
}
