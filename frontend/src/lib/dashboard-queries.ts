"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
  getProfile,
  listOrders,
  listInventory,
  getVouchStatus,
  listSupportTickets,
  getUnreadNotificationCount,
  listNotifications,
  type VendorOrder,
  type VendorInventoryWithProduct,
  type SupportTicket,
  type VendorNotification,
} from "@/lib/api";
import { getOnboardingPhone } from "@/lib/onboarding-session";

export const dashboardQueryKeys = {
  profile: (phone: string) => ["dashboard", "profile", phone] as const,
  orders: (phone: string) => ["dashboard", "orders", phone] as const,
  inventory: (phone: string) => ["dashboard", "inventory", phone] as const,
  vouch: (phone: string) => ["dashboard", "vouch", phone] as const,
  tickets: (phone: string) => ["dashboard", "tickets", phone] as const,
  notifications: (phone: string) => ["dashboard", "notifications", phone] as const,
  notificationsUnread: (phone: string) => ["dashboard", "notifications-unread", phone] as const,
};

export type InventoryRow = VendorInventoryWithProduct;

async function fetchProfile(phone: string) {
  const res = await getProfile(phone);
  if (!res.success) return null;
  return res.profile ?? null;
}

async function fetchOrders(phone: string): Promise<VendorOrder[]> {
  const res = await listOrders(phone);
  if (!res.success) return [];
  return res.orders ?? [];
}

/** Single list request; product cards are batch-loaded on the server. */
async function fetchInventoryEnriched(phone: string): Promise<InventoryRow[]> {
  const res = await listInventory(phone);
  if (!res.success) return [];
  return res.inventory ?? [];
}

async function fetchVouchStatus(phone: string) {
  const res = await getVouchStatus(phone);
  if (!res.success) return { vouchCount: 0 };
  return { vouchCount: res.vouchCount ?? 0 };
}

export function useProfileQuery(phone: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.profile(phone),
    queryFn: () => fetchProfile(phone),
    enabled: !!phone,
  });
}

export function useOrdersQuery(phone: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.orders(phone),
    queryFn: () => fetchOrders(phone),
    enabled: !!phone,
    refetchInterval: 8_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useInventoryQuery(phone: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.inventory(phone),
    queryFn: () => fetchInventoryEnriched(phone),
    enabled: !!phone,
    // Fresh list when returning from another tab (e.g. edited listing elsewhere).
    refetchOnWindowFocus: true,
  });
}

export function useVouchStatusQuery(phone: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.vouch(phone),
    queryFn: () => fetchVouchStatus(phone),
    enabled: !!phone,
  });
}

async function fetchTickets(phone: string): Promise<SupportTicket[]> {
  const res = await listSupportTickets(phone);
  if (!res.success) return [];
  return res.tickets ?? [];
}

export function useSupportTicketsQuery(phone: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.tickets(phone),
    queryFn: () => fetchTickets(phone),
    enabled: !!phone,
    refetchInterval: 8_000,
    refetchOnReconnect: true,
  });
}

async function fetchNotificationsFull(phone: string): Promise<{
  notifications: VendorNotification[];
  unreadCount: number;
}> {
  const res = await listNotifications(phone);
  if (!res.success) return { notifications: [], unreadCount: 0 };
  return { notifications: res.notifications ?? [], unreadCount: res.unreadCount ?? 0 };
}

/** Full list + unread; polls on the notifications screen (slightly slower when tab hidden). */
export function useNotificationsQuery(phone: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.notifications(phone),
    queryFn: () => fetchNotificationsFull(phone),
    enabled: !!phone,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? false : 4000),
    refetchOnReconnect: true,
  });
}

async function fetchUnreadOnly(phone: string): Promise<number> {
  const res = await getUnreadNotificationCount(phone);
  if (!res.success) return 0;
  return res.unreadCount ?? 0;
}

/** Navbar bell: faster poll on /dashboard/notifications, slower elsewhere; pauses when tab hidden. */
export function useNotificationsUnreadQuery(phone: string) {
  const pathname = usePathname();
  const onNotificationsPage = pathname === "/dashboard/notifications";
  return useQuery({
    queryKey: dashboardQueryKeys.notificationsUnread(phone),
    queryFn: () => fetchUnreadOnly(phone),
    enabled: !!phone,
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.hidden) return false;
      return onNotificationsPage ? 4000 : 8000;
    },
    refetchOnReconnect: true,
  });
}
