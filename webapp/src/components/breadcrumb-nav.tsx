"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Flower2,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  Plus,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Group, Plant, Pump } from "@/lib/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface Crumb {
  icon?: ReactNode;
  label: string;
  href?: string;
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);

  useEffect(() => {
    async function buildCrumbs() {
      const parts = pathname.split("/").filter(Boolean);
      const result: Crumb[] = [];

      if (parts[0] === "dashboard") {
        result.push({
          icon: <LayoutDashboard className="size-3.5" />,
          label: "Dashboard",
        });
      } else if (parts[0] === "groups") {
        if (parts[1] === "new") {
          result.push({
            icon: <Plus className="size-3.5" />,
            label: "New Group",
          });
        } else if (parts[1]) {
          try {
            const group = await apiFetch<Group>(`/groups/${parts[1]}`);
            result.push({
              icon: <FolderOpen className="size-3.5" />,
              label: group.name,
            });
          } catch {
            result.push({
              icon: <FolderOpen className="size-3.5" />,
              label: `Group ${parts[1]}`,
            });
          }
        } else {
          result.push({
            icon: <FolderOpen className="size-3.5" />,
            label: "Groups",
          });
        }
      } else if (parts[0] === "plants") {
        if (parts[1] === "new") {
          result.push({
            icon: <Plus className="size-3.5" />,
            label: "New Plant",
          });
        } else if (parts[1]) {
          try {
            const plant = await apiFetch<Plant>(`/plants/${parts[1]}`);
            if (plant.group_id) {
              const group = await apiFetch<Group>(`/groups/${plant.group_id}`);
              result.push({
                icon: <FolderOpen className="size-3.5" />,
                label: group.name,
                href: `/groups/${group.id}`,
              });
            }
            result.push({
              icon: <Flower2 className="size-3.5" />,
              label: plant.name,
            });
          } catch {
            result.push({
              icon: <Flower2 className="size-3.5" />,
              label: `Plant ${parts[1]}`,
            });
          }
        }
      } else if (parts[0] === "pumps") {
        if (parts[1] === "new") {
          result.push({
            icon: <Plus className="size-3.5" />,
            label: "New Pump",
          });
        } else if (parts[1]) {
          try {
            const pump = await apiFetch<Pump>(`/pumps/${parts[1]}`);
            if (pump.group_id) {
              const group = await apiFetch<Group>(`/groups/${pump.group_id}`);
              result.push({
                icon: <FolderOpen className="size-3.5" />,
                label: group.name,
                href: `/groups/${group.id}`,
              });
            }
            result.push({
              icon: <Gauge className="size-3.5" />,
              label: pump.name,
            });
          } catch {
            result.push({
              icon: <Gauge className="size-3.5" />,
              label: `Pump ${parts[1]}`,
            });
          }
        }
      } else if (parts[0] === "firmware-settings") {
        result.push({
          icon: <Zap className="size-3.5" />,
          label: "Firmware Settings",
        });
      }

      setCrumbs(result);
    }
    buildCrumbs();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 shadow-xs">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <span key={i} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i < crumbs.length - 1 && crumb.href ? (
                  <BreadcrumbLink
                    href={crumb.href}
                    className="flex items-center gap-1.5"
                  >
                    {crumb.icon}
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="flex items-center gap-1.5">
                    {crumb.icon}
                    {crumb.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
