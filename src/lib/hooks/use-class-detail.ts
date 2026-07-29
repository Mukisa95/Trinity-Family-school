import { useClass } from './use-classes';

/**
 * Class detail is a selector over the canonical class list. Keeping it this
 * way prevents every detail page from opening its own document listener or
 * issuing a direct getById read.
 */
export function useClassDetail(id: string) {
  return useClass(id);
}
