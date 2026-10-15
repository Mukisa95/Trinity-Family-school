import type { QueryClient } from '@tanstack/react-query';
import type { SystemUser, RequirementItem, UniformItem, ExcludedDay } from '@/types';
import { RequirementsService } from '@/lib/services/requirements.service';
import { UniformsService } from '@/lib/services/uniforms.service';
import { ExcludedDaysService } from '@/lib/services/excluded-days.service';
import { catalogueQueryOptions, ensureCatalogue, subscribeCatalogueOwner, type CatalogueName } from './school-catalogue-cache';

export const readRequirementsCatalogue = () => RequirementsService.getAllRequirements(true);
export const readUniformsCatalogue = () => UniformsService.getAllUniforms(true);
export const readExcludedDaysCatalogue = () => ExcludedDaysService.getAllExcludedDays();
type CatalogueItems = { requirements: RequirementItem; uniforms: UniformItem; excludedDays: ExcludedDay };
const readers = { requirements: readRequirementsCatalogue, uniforms: readUniformsCatalogue, excludedDays: readExcludedDaysCatalogue };
export function schoolCatalogueOptions<N extends CatalogueName>(client: QueryClient, name: N, user: SystemUser) {
  return catalogueQueryOptions<CatalogueItems[N]>(client, name, user, readers[name] as () => Promise<CatalogueItems[N][]>);
}

export function ensureSchoolCatalogue<N extends CatalogueName>(client: QueryClient, name: N, user: SystemUser, active?: () => boolean) {
  return ensureCatalogue<CatalogueItems[N]>(client, name, user, readers[name] as () => Promise<CatalogueItems[N][]>, active);
}
export function subscribeSchoolCatalogue<N extends CatalogueName>(client: QueryClient, name: N, user: SystemUser) {
  return subscribeCatalogueOwner<CatalogueItems[N]>(client, name, user, readers[name] as () => Promise<CatalogueItems[N][]>);
}
