import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We capture manually via PostHogProvider
    capture_pageleave: true,
    advanced_disable_feature_flags: true, // No feature flags used — prevents 401 on /flags/
    advanced_disable_feature_flags_on_first_load: true,
  });
}

export function identifyUser(uid: string, props: { email?: string; role?: string; username?: string }) {
  if (typeof window === 'undefined') return;
  posthog.identify(uid, props);
}

export function resetUser() {
  if (typeof window === 'undefined') return;
  posthog.reset();
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  posthog.capture(event, properties);
}

export { posthog };
