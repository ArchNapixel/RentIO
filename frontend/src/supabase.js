// Supabase Auth for logins. The publishable key is safe in the app; all data still goes through our backend.
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce' },
});

const native = Capacitor.isNativePlatform();
const NATIVE_REDIRECT = 'com.rentio.app://login-callback';
// Where email links (confirm account, reset password) come back to: this page on the web, the app itself on Android.
// Add com.rentio.app://login-callback to Redirect URLs in the Supabase dashboard (Authentication › URL Configuration).
export const webRedirect = () => (native ? NATIVE_REDIRECT : location.origin);

// Google blocks sign-in inside app web views, so on Android we open the phone's browser
// and Google sends the owner back to com.rentio.app://login-callback?code=…
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: native ? { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true } : { redirectTo: webRedirect() },
  });
  if (error) throw error;
  if (native) await Browser.open({ url: data.url });
}

if (native) {
  NativeApp.addListener('appUrlOpen', async ({ url }) => {
    const code = new URL(url).searchParams.get('code');
    if (!code) return;
    await Browser.close().catch(() => {});
    await supabase.auth.exchangeCodeForSession(code).catch(() => {}); // an expired or reused link just leaves you on the login screen
  });
}
