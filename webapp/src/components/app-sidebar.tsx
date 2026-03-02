"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Flower2,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  LogOut,
  Plus,
  Sprout,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Group, Plant, Pump } from "@/lib/types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GroupWithChildren extends Group {
  plants: Plant[];
  pump: Pump | null;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [groups, setGroups] = useState<GroupWithChildren[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [allGroups, allPlants, allPumps] = await Promise.all([
          apiFetch<Group[]>("/groups"),
          apiFetch<Plant[]>("/plants"),
          apiFetch<Pump[]>("/pumps"),
        ]);
        const enriched: GroupWithChildren[] = allGroups.map((g) => ({
          ...g,
          plants: allPlants.filter((p) => p.group_id === g.id),
          pump: allPumps.find((p) => p.group_id === g.id) ?? null,
        }));
        setGroups(enriched);
      } catch {
        // Not loaded yet
      }
    }
    load();
  }, [pathname]);

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sprout className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                  <span className="truncate font-semibold">Plant Manager</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Watering System
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/dashboard"}
                tooltip="Dashboard"
              >
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/firmware-settings"}
                tooltip="Firmware"
              >
                <Link href="/firmware-settings">
                  <Zap />
                  <span>Firmware</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Groups */}
        <SidebarGroup>
          <SidebarGroupLabel>Groups</SidebarGroupLabel>
          <SidebarGroupAction asChild title="Add Group">
            <Link href="/groups/new">
              <Plus />
            </Link>
          </SidebarGroupAction>
          <SidebarMenu>
            {groups.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/groups/new"
                    className="text-muted-foreground"
                  >
                    <Plus />
                    <span>Create first group</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {groups.map((group) => {
              const isGroupActive =
                pathname === `/groups/${group.id}` ||
                group.plants.some((p) => pathname === `/plants/${p.id}`) ||
                (group.pump !== null &&
                  pathname === `/pumps/${group.pump.id}`);

              return (
                <Collapsible
                  key={group.id}
                  asChild
                  defaultOpen={isGroupActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={group.name}
                        isActive={pathname === `/groups/${group.id}`}
                        onClick={(e) => {
                          // Navigate to group page on click
                          window.location.href = `/groups/${group.id}`;
                        }}
                      >
                        <FolderOpen />
                        <span>{group.name}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {group.plants.map((plant) => (
                          <SidebarMenuSubItem key={plant.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === `/plants/${plant.id}`}
                            >
                              <Link href={`/plants/${plant.id}`}>
                                <Flower2 className="size-3" />
                                <span>{plant.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                        {group.pump && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                pathname === `/pumps/${group.pump.id}`
                              }
                            >
                              <Link href={`/pumps/${group.pump.id}`}>
                                <Gauge className="size-3" />
                                <span>{group.pump.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <LogOut />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
