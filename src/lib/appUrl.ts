const DEFAULT_PUBLIC_APP_URL = "https://bookd.ie";

const trimTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

export const getPublicAppUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_APP_URL;

  if (configuredUrl) {
    return trimTrailingSlashes(configuredUrl);
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const isNativeOrigin = origin.startsWith("capacitor://") || origin.startsWith("ionic://");

    if (origin && !isLocalHost && !isNativeOrigin) {
      return trimTrailingSlashes(origin);
    }
  }

  return DEFAULT_PUBLIC_APP_URL;
};

export const getPublicAppPath = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicAppUrl()}${normalizedPath}`;
};
