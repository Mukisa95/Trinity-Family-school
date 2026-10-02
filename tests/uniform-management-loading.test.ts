import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';

const uniform = {
  id: 'shirt', name: 'SHIRT', group: 'Shirts', price: 30000, isActive: true,
  gender: 'all', classType: 'all', sectionType: 'all',
};

function nodes(root: unknown): React.ReactElement<any>[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!React.isValidElement(root)) return [];
  return [root, ...nodes((root.props as any).children)];
}

function text(root: any): string {
  if (Array.isArray(root)) return root.map(text).join('');
  if (React.isValidElement(root)) return text((root.props as any).children);
  return typeof root === 'string' || typeof root === 'number' ? String(root) : '';
}

function loadComponent(file: string, hookOverrides: Record<string, unknown> = {}) {
  const states: any[] = [];
  const effectDeps: unknown[][] = [];
  let stateIndex = 0;
  let effectIndex = 0;
  let effects: Array<() => void> = [];
  const queryResult = { data: [uniform], isLoading: false, isFetching: false, error: null, refetch: async () => {} };
  const hooks: Record<string, any> = {
    useUniforms: () => queryResult,
    useActiveUniforms: () => queryResult,
    useUniformsByFilter: () => queryResult,
    useClasses: () => ({ data: [] }),
    usePupil: () => ({ data: { id: 'pupil', firstName: 'Test', lastName: 'Pupil', gender: 'Male' }, isLoading: false }),
    useUniformTrackingByPupil: () => ({ data: [], isLoading: false, isFetching: false, error: null }),
    useUniformInventory: () => ({ data: [] }),
    useConfirmDialog: () => ({ confirm: async () => false, ConfirmDialog: 'ConfirmDialog' }),
    ...hookOverrides,
  };
  const mutation = { mutateAsync: async () => 'created', isPending: false };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  vm.runInNewContext(output, {
    module, exports: module.exports, console, alert() {},
    require(name: string) {
      if (name === 'react') return {
        ...React,
        useState(initial: unknown) {
          const index = stateIndex++;
          if (!(index in states)) states[index] = initial;
          return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        },
        useMemo: (compute: () => unknown) => compute(),
        useEffect(effect: () => void, deps: unknown[]) {
          const index = effectIndex++;
          if (!effectDeps[index] || deps.some((value, i) => value !== effectDeps[index][i])) {
            effectDeps[index] = deps;
            effects.push(effect);
          }
        },
      };
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams('id=pupil') };
      if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries() {} }) };
      if (name === '@/hooks/use-toast') return { useToast: () => ({ toast() {} }) };
      if (name === '@/lib/utils') return { formatCurrency: (value: number) => `UGX ${value}`, parseFormattedMoney: Number };
      if (name === '@/lib/utils/logger') return { logger: { error() {} } };
      if (name.includes('/hooks/')) return new Proxy({}, { get: (_, key: string) => hooks[key] || (() => mutation) });
      return new Proxy({}, { get: (_, key: string) => key === '__esModule' ? false : key });
    },
    URLSearchParams,
  });
  return {
    render(props: Record<string, unknown> = {}) {
      stateIndex = 0;
      effectIndex = 0;
      effects = [];
      const component = module.exports.UniformManagement || (module.exports.default().props.children.type);
      const tree = component(props);
      const pending = effects;
      effects = [];
      pending.forEach(effect => effect());
      return tree;
    },
  };
}

const managementFile = 'src/app/fees/components/uniform-management.tsx';

test('toolbar Add opens the rendered uniform creation dialog', () => {
  const component = loadComponent(managementFile);
  component.render({ showFilters: false, addTrigger: 0 });
  component.render({ showFilters: false, addTrigger: 1 });
  const modal = nodes(component.render({ showFilters: false, addTrigger: 1 })).find(node => node.type === 'UniformModal');
  assert.ok(modal, 'The management page must render its uniform dialog');
  assert.equal(modal.props.isOpen, true);
  assert.equal(modal.props.mode, 'add');
});

test('Edit opens the same dialog with the selected uniform', () => {
  const component = loadComponent(managementFile);
  const tree = component.render({ showFilters: false, addTrigger: 0 });
  const edit = nodes(tree).find(node => node.type === 'Button' && text(node) === 'Edit');
  assert.ok(edit);
  edit.props.onClick();
  const modal = nodes(component.render({ showFilters: false, addTrigger: 0 })).find(node => node.type === 'UniformModal');
  assert.ok(modal);
  assert.equal(modal.props.isOpen, true);
  assert.equal(modal.props.mode, 'edit');
  assert.equal(modal.props.initialData.name, uniform.name);
});

test('Add remains available when the catalogue read failed', () => {
  const component = loadComponent(managementFile, {
    useUniforms: () => ({ data: [], isLoading: false, isFetching: false, error: new Error('offline'), refetch() {} }),
  });
  component.render({ showFilters: false, addTrigger: 1 });
  const modal = nodes(component.render({ showFilters: false, addTrigger: 1 })).find(node => node.type === 'UniformModal');
  assert.ok(modal);
  assert.equal(modal.props.isOpen, true);
});

test('tracking does not present an empty cached list as no assignments while fetching', () => {
  const component = loadComponent('src/app/uniform-tracking/page.tsx', {
    useUniformTrackingByPupil: () => ({ data: [], isLoading: false, isFetching: true, error: null }),
  });
  assert.doesNotMatch(text(component.render()), /No uniforms assigned yet/);
});

test('management shows loading rather than zero items while the catalogue is being fetched', () => {
  const component = loadComponent(managementFile, {
    useUniforms: () => ({ data: [], isLoading: false, isFetching: true, error: null, refetch() {} }),
  });
  const content = text(component.render({ showFilters: false, addTrigger: 0 }));
  assert.match(content, /Loading uniforms/);
  assert.doesNotMatch(content, /0 of 0|No uniforms yet/);
});

test('tracking waits for its uniform catalogue before presenting amounts or assignments', () => {
  const component = loadComponent('src/app/uniform-tracking/page.tsx', {
    useUniformsByFilter: () => ({ data: [], isLoading: true, isFetching: true, error: null }),
    useActiveUniforms: () => ({ data: [], isLoading: true, isFetching: true, error: null }),
  });
  const tree = component.render();
  assert.doesNotMatch(text(tree), /No uniforms assigned yet/);
  const add = nodes(tree).find(node => node.type === 'Button' && /Loading uniforms/.test(text(node)));
  assert.ok(add);
  assert.equal(add.props.disabled, true);
});

test('failed creation keeps the dialog open and rejects the submission', async () => {
  const error = new Error('permission-denied');
  const component = loadComponent(managementFile, {
    useCreateUniform: () => ({ mutateAsync: async () => { throw error; } }),
  });
  component.render({ showFilters: false, addTrigger: 1 });
  const modal = nodes(component.render({ showFilters: false, addTrigger: 1 })).find(node => node.type === 'UniformModal');
  assert.ok(modal);
  await assert.rejects(() => modal.props.onSubmit({ ...uniform, price: '30000' }), failure => failure === error);
  const after = nodes(component.render({ showFilters: false, addTrigger: 1 })).find(node => node.type === 'UniformModal');
  assert.ok(after);
  assert.equal(after.props.isOpen, true);
});

test('tracking reports failed reads rather than claiming no assignments', () => {
  const component = loadComponent('src/app/uniform-tracking/page.tsx', {
    useUniformTrackingByPupil: () => ({ data: [], isLoading: false, isFetching: false, error: new Error('permission-denied') }),
  });
  const content = text(component.render());
  assert.doesNotMatch(content, /No uniforms assigned yet/);
  assert.match(content, /Unable to load uniform records/);
});
