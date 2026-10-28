import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

// Server component mein use karo
export async function getSession() {
  return await getServerSession(authOptions);
}

// Permission check
export async function hasPermission(slug: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const permissions = (session.user as any).permissions as string[];
  return permissions.includes(slug);
}

// Role check
export async function hasRole(slug: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const roles = (session.user as any).roles as string[];
  return roles.includes(slug);
}