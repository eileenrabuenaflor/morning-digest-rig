import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { isNightName } from './digest/present.js';
import { readNight } from './digest/read-night.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = isNightName(night) ? readNight(config.runsDir, night) : null;
    if (!data) return c.json({ error: 'not found' }, 404);
    return c.json(data);
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = isNightName(night) ? readNight(config.runsDir, night) : null;
    if (!digest) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <h1>no digest</h1>
          <p class="mute">no run log for {night}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={digest} />
      </Layout>,
    );
  });

  return app;
}
