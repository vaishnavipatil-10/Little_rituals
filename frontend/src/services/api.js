import axios from 'axios';
import { supabase } from './supabase.js';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const result = await supabase?.auth.getSession();
  const token = result?.data?.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
