
import { createApp } from '../backend/src/app.js';

const app = createApp();

export function restoreApiPath(url = '/') {
  const parsed = new URL(url, 'http://vercel.local');
  const apiPath = parsed.searchParams.get('__api_path');
  if (!apiPath) return url;

  parsed.searchParams.delete('__api_path');
  const normalizedPath = apiPath.replace(/^\/+/, '');
  return `/api/${normalizedPath}${parsed.search}`;
}

export default function handler(request, response) {
  request.url = restoreApiPath(request.url);
  return app(request, response);
}
