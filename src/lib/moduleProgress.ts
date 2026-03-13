import { Module } from "@/types";

export function getRequiredModuleIds(module: Module, moduleList: Module[]): string[] {
  const sequentialIds = moduleList
    .filter((candidate) => candidate.order < module.order)
    .sort((left, right) => left.order - right.order)
    .map((candidate) => candidate.id);

  return Array.from(new Set([...sequentialIds, ...(module.prerequisites || [])]));
}

export function getBlockingModules(module: Module, moduleList: Module[], completedIds: string[]): Module[] {
  return getRequiredModuleIds(module, moduleList)
    .map((requiredId) => moduleList.find((candidate) => candidate.id === requiredId) || null)
    .filter((candidate): candidate is Module => Boolean(candidate))
    .filter((candidate) => !completedIds.includes(candidate.id))
    .sort((left, right) => left.order - right.order);
}

export function canAccessModuleEntry(module: Module, moduleList: Module[], completedIds: string[]): boolean {
  return getBlockingModules(module, moduleList, completedIds).length === 0;
}