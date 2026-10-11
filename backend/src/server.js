import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
const port = Number(process.env.PORT || 3000);
createApp().listen(port, () => console.info(`Little Rituals API listening on port ${port}`));
