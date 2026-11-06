import type { Night } from '../digest/types.js';
import { isFlagged, orMissing } from '../digest/present.js';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      <p class="mute">
        {night.badLines} bad {night.badLines === 1 ? 'line' : 'lines'} skipped
      </p>
      {night.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => {
              const flagged = isFlagged(r);
              return (
                <tr class={flagged ? 'warn' : undefined}>
                  <td>
                    {flagged ? <span class="warn">[!] </span> : null}
                    {r.job}
                  </td>
                  <td>{orMissing(r.owner)}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}</td>
                  <td>
                    {r.lastStatus}
                    {flagged ? <span class="warn"> [!]</span> : null}
                  </td>
                  <td>{orMissing(r.lastError)}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
