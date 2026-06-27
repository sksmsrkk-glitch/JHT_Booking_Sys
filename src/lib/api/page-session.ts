import { cookies, headers } from "next/headers";

export async function getPageAuthorization() {
  const headerStore = await headers();
  const directAuthorization = headerStore.get("authorization");
  if (directAuthorization) {
    return { authorization: directAuthorization, headerStore };
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("jht_access_token")?.value;
  return {
    authorization: accessToken ? `Bearer ${accessToken}` : "",
    headerStore
  };
}

export function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}
