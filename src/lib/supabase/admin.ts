import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type RuntimeEnv = CloudflareEnv & {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function getProcessRuntimeEnv() {
  // OpenNext copies Cloudflare string bindings into process.env at request
  // startup. The indirect lookup keeps secrets runtime-only and avoids
  // build-time replacement by Next.js.
  const runtimeProcessEnv = process.env as Record<string, string | undefined>;
  return {
    url: runtimeProcessEnv['NEXT_PUBLIC_SUPABASE_URL'],
    key: runtimeProcessEnv['SUPABASE_SERVICE_ROLE_KEY'],
  };
}

export class AdminClientConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminClientConfigError';
  }
}

export function isAdminClientConfigError(error: unknown): error is AdminClientConfigError {
  return error instanceof AdminClientConfigError;
}

function createSupabaseAdminClient(url: string, key: string) {
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Service role client for admin operations. Keep this module server-only because
// it protects the database trust boundary from client bundle exposure.
export function createAdminClient() {
  const processRuntimeEnv = getProcessRuntimeEnv();
  let url = processRuntimeEnv.url;
  let key = processRuntimeEnv.key;

  if (!url || !key) {
    try {
      const ctx = getCloudflareContext();
      const runtimeEnv = ctx.env as RuntimeEnv;
      url ||= runtimeEnv.NEXT_PUBLIC_SUPABASE_URL;
      key ||= runtimeEnv.SUPABASE_SERVICE_ROLE_KEY;
    } catch {
      // The Cloudflare request context does not exist during local Node.js builds.
    }
  }

  if (!url) {
    throw new AdminClientConfigError('createAdminClient: NEXT_PUBLIC_SUPABASE_URL is missing.');
  }
  if (!key) {
    throw new AdminClientConfigError('createAdminClient: SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  return createSupabaseAdminClient(url, key);
}

export async function createAdminClientAsync() {
  const processRuntimeEnv = getProcessRuntimeEnv();
  let url = processRuntimeEnv.url;
  let key = processRuntimeEnv.key;

  if (!url || !key) {
    try {
      const ctx = await getCloudflareContext({ async: true });
      const runtimeEnv = ctx.env as RuntimeEnv;
      url ||= runtimeEnv.NEXT_PUBLIC_SUPABASE_URL;
      key ||= runtimeEnv.SUPABASE_SERVICE_ROLE_KEY;
    } catch {
      // Local Node.js builds and non-Cloudflare runtimes may not expose a request context.
    }
  }

  if (!url) {
    throw new AdminClientConfigError('createAdminClient: NEXT_PUBLIC_SUPABASE_URL is missing.');
  }
  if (!key) {
    throw new AdminClientConfigError('createAdminClient: SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  return createSupabaseAdminClient(url, key);
}
