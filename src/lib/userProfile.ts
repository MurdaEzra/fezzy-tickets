import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
};

function md5(input: string): string {
  const utf8 = new TextEncoder().encode(input.trim().toLowerCase());
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8[i] << ((i % 4) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << ((utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) + 1) * 16 - 2] = utf8.length * 8;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const ff = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = (aa + ((bb & cc) | (~bb & dd)) + x + t) | 0;
    return (((r << s) | (r >>> (32 - s))) + bb) | 0;
  };
  const gg = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = (aa + ((bb & dd) | (cc & ~dd)) + x + t) | 0;
    return (((r << s) | (r >>> (32 - s))) + bb) | 0;
  };
  const hh = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = (aa + (bb ^ cc ^ dd) + x + t) | 0;
    return (((r << s) | (r >>> (32 - s))) + bb) | 0;
  };
  const ii = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = (aa + (cc ^ (bb | ~dd)) + x + t) | 0;
    return (((r << s) | (r >>> (32 - s))) + bb) | 0;
  };

  for (let i = 0; i < words.length; i += 16) {
    const oa = a;
    const ob = b;
    const oc = c;
    const od = d;

    a = ff(a, b, c, d, words[i] ?? 0, 7, -680876936);
    d = ff(d, a, b, c, words[i + 1] ?? 0, 12, -389564586);
    c = ff(c, d, a, b, words[i + 2] ?? 0, 17, 606105819);
    b = ff(b, c, d, a, words[i + 3] ?? 0, 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4] ?? 0, 7, -176418897);
    d = ff(d, a, b, c, words[i + 5] ?? 0, 12, 1200080426);
    c = ff(c, d, a, b, words[i + 6] ?? 0, 17, -1473231341);
    b = ff(b, c, d, a, words[i + 7] ?? 0, 22, -45705983);
    a = ff(a, b, c, d, words[i + 8] ?? 0, 7, 1770035416);
    d = ff(d, a, b, c, words[i + 9] ?? 0, 12, -1958414417);
    c = ff(c, d, a, b, words[i + 10] ?? 0, 17, -42063);
    b = ff(b, c, d, a, words[i + 11] ?? 0, 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12] ?? 0, 7, 1804603682);
    d = ff(d, a, b, c, words[i + 13] ?? 0, 12, -40341101);
    c = ff(c, d, a, b, words[i + 14] ?? 0, 17, -1502002290);
    b = ff(b, c, d, a, words[i + 15] ?? 0, 22, 1236535329);

    a = gg(a, b, c, d, words[i + 1] ?? 0, 5, -165796510);
    d = gg(d, a, b, c, words[i + 6] ?? 0, 9, -1069501632);
    c = gg(c, d, a, b, words[i + 11] ?? 0, 14, 643717713);
    b = gg(b, c, d, a, words[i] ?? 0, 20, -373897302);
    a = gg(a, b, c, d, words[i + 5] ?? 0, 5, -701558691);
    d = gg(d, a, b, c, words[i + 10] ?? 0, 9, 38016083);
    c = gg(c, d, a, b, words[i + 15] ?? 0, 14, -660478335);
    b = gg(b, c, d, a, words[i + 4] ?? 0, 20, -405537848);
    a = gg(a, b, c, d, words[i + 9] ?? 0, 5, 568446438);
    d = gg(d, a, b, c, words[i + 14] ?? 0, 9, -1019803690);
    c = gg(c, d, a, b, words[i + 3] ?? 0, 14, -187363961);
    b = gg(b, c, d, a, words[i + 8] ?? 0, 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13] ?? 0, 5, -1444681467);
    d = gg(d, a, b, c, words[i + 2] ?? 0, 9, -51403784);
    c = gg(c, d, a, b, words[i + 7] ?? 0, 14, 1735328473);
    b = gg(b, c, d, a, words[i + 12] ?? 0, 20, -1926607734);

    a = hh(a, b, c, d, words[i + 5] ?? 0, 4, -378558);
    d = hh(d, a, b, c, words[i + 8] ?? 0, 11, -2022574463);
    c = hh(c, d, a, b, words[i + 11] ?? 0, 16, 1839030562);
    b = hh(b, c, d, a, words[i + 14] ?? 0, 23, -35309556);
    a = hh(a, b, c, d, words[i + 1] ?? 0, 4, -1530992060);
    d = hh(d, a, b, c, words[i + 4] ?? 0, 11, 1272893353);
    c = hh(c, d, a, b, words[i + 7] ?? 0, 16, -155497632);
    b = hh(b, c, d, a, words[i + 10] ?? 0, 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13] ?? 0, 4, 681279174);
    d = hh(d, a, b, c, words[i] ?? 0, 11, -358537222);
    c = hh(c, d, a, b, words[i + 3] ?? 0, 16, -722521979);
    b = hh(b, c, d, a, words[i + 6] ?? 0, 23, 76029189);
    a = hh(a, b, c, d, words[i + 9] ?? 0, 4, -640364487);
    d = hh(d, a, b, c, words[i + 12] ?? 0, 11, -421815835);
    c = hh(c, d, a, b, words[i + 15] ?? 0, 16, 530742520);
    b = hh(b, c, d, a, words[i + 2] ?? 0, 23, -995338651);

    a = ii(a, b, c, d, words[i] ?? 0, 6, -198630844);
    d = ii(d, a, b, c, words[i + 7] ?? 0, 10, 1126891415);
    c = ii(c, d, a, b, words[i + 14] ?? 0, 15, -1416354905);
    b = ii(b, c, d, a, words[i + 5] ?? 0, 21, -57434055);
    a = ii(a, b, c, d, words[i + 12] ?? 0, 6, 1700485571);
    d = ii(d, a, b, c, words[i + 3] ?? 0, 10, -1894986606);
    c = ii(c, d, a, b, words[i + 10] ?? 0, 15, -1051523);
    b = ii(b, c, d, a, words[i + 1] ?? 0, 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8] ?? 0, 6, 1873313359);
    d = ii(d, a, b, c, words[i + 15] ?? 0, 10, -30611744);
    c = ii(c, d, a, b, words[i + 6] ?? 0, 15, -1560198380);
    b = ii(b, c, d, a, words[i + 13] ?? 0, 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4] ?? 0, 6, -145523070);
    d = ii(d, a, b, c, words[i + 11] ?? 0, 10, -1120210379);
    c = ii(c, d, a, b, words[i + 2] ?? 0, 15, 718787259);
    b = ii(b, c, d, a, words[i + 9] ?? 0, 21, -343485551);

    a = (a + oa) | 0;
    b = (b + ob) | 0;
    c = (c + oc) | 0;
    d = (d + od) | 0;
  }

  const toHex = (n: number) => {
    let s = "";
    for (let j = 0; j < 4; j++) s += ((n >> (j * 8)) & 0xff).toString(16).padStart(2, "0");
    return s;
  };

  return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
}

export function gravatarUrl(email: string, size = 80) {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

export function resolveAvatarUrl(user: User | null, profile?: Pick<UserProfile, "avatar_url" | "full_name"> | null) {
  if (profile?.avatar_url) return profile.avatar_url;
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  if (meta?.avatar_url) return meta.avatar_url;
  if (meta?.picture) return meta.picture;
  if (user?.email) return gravatarUrl(user.email);
  return null;
}

export function resolveDisplayName(user: User | null, profile?: Pick<UserProfile, "full_name"> | null) {
  const fromProfile = profile?.full_name?.trim();
  if (fromProfile) return fromProfile;
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name?.trim() || meta?.name?.trim() || user?.email?.split("@")[0] || "User";
}

export function resolveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "U").toUpperCase();
}

export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, phone, country")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}
