/**
 * lib/toast.ts
 *
 * Tiny global toast helper. Any client component can call showToast(...) to
 * pop a top-right confirmation/alert; the <Toaster/> mounted in the admin
 * layout renders them. Uses a window CustomEvent so there's no provider/prop
 * plumbing required.
 */

export type ToastType = 'success' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'success') {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}
