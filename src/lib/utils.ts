import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Secure cookie utility functions
export function setCookie(
  name: string,
  value: string,
  days: number = 365,
  secure: boolean = true,
  sameSite: "Strict" | "Lax" | "None" = "Lax"
) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "; expires=" + date.toUTCString();
  
  // Secure flag only in HTTPS environments
  const isSecure = secure && window.location.protocol === "https:";
  
  let cookieString = name + "=" + (value || "") + expires + "; path=/; SameSite=" + sameSite;
  if (isSecure) {
    cookieString += "; Secure";
  }
  
  document.cookie = cookieString;
}

export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function eraseCookie(name: string) {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

