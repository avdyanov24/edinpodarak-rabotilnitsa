import type { APIRoute } from 'astro';
import { clearSession } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  // Revokes the row as well as dropping the cookie: a copy of the cookie
  // taken from somewhere else has to stop working too.
  await clearSession(cookies);
  return redirect('/admin/vhod', 302);
};
