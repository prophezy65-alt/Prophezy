import type { InternshipProvider, ProviderDescriptor } from '../types';
import { ALL_DESCRIPTORS, STUB_PROVIDERS } from '../config/provider-registry';
import { StubProvider } from './base/stub.provider';

import { GreenhouseProvider } from './ats/greenhouse.provider';
import { LeverProvider } from './ats/lever.provider';
import { AshbyProvider } from './ats/ashby.provider';
import { AdzunaProvider } from './aggregators/adzuna.provider';
import { JoobleProvider } from './aggregators/jooble.provider';
import { TheMuseProvider } from './aggregators/themuse.provider';
import { RemotiveProvider } from './aggregators/remotive.provider';
import { RemoteOkProvider } from './aggregators/remoteok.provider';
import { WeWorkRemotelyProvider } from './aggregators/weworkremotely.provider';
import { ArbeitnowProvider } from './aggregators/arbeitnow.provider';

type ProviderFactory = () => InternshipProvider;

/**
 * THE ONLY PLACE a new source is wired in.
 * Add a descriptor to `config/provider-registry.ts`, add one line here, done —
 * scheduler, health monitoring, filters, analytics and the admin UI pick it up
 * automatically from the descriptor.
 */
const FACTORIES: Record<string, ProviderFactory> = {
  greenhouse: () => new GreenhouseProvider(),
  lever: () => new LeverProvider(),
  ashby: () => new AshbyProvider(),
  adzuna: () => new AdzunaProvider(),
  jooble: () => new JoobleProvider(),
  themuse: () => new TheMuseProvider(),
  remotive: () => new RemotiveProvider(),
  remoteok: () => new RemoteOkProvider(),
  weworkremotely: () => new WeWorkRemotelyProvider(),
  arbeitnow: () => new ArbeitnowProvider(),
  ...Object.fromEntries(
    STUB_PROVIDERS.map((descriptor): [string, ProviderFactory] => [
      descriptor.key,
      () => new StubProvider(descriptor),
    ]),
  ),
};

const instances = new Map<string, InternshipProvider>();

export function createProvider(key: string): InternshipProvider | null {
  const cached = instances.get(key);
  if (cached) return cached;

  const factory = FACTORIES[key];
  if (!factory) return null;

  const instance = factory();
  instances.set(key, instance);
  return instance;
}

export function listProviders(): InternshipProvider[] {
  return ALL_DESCRIPTORS
    .map((descriptor) => createProvider(descriptor.key))
    .filter((provider): provider is InternshipProvider => provider !== null);
}

/** Providers that are implemented, configured and not disabled — i.e. worth syncing. */
export function listSyncableProviders(): InternshipProvider[] {
  const disabled = new Set(
    (process.env.INTERNSHIP_DISABLED_PROVIDERS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  );
  return listProviders().filter((provider) => {
    const { key, status } = provider.descriptor;
    if (disabled.has(key)) return false;
    if (status === 'unsupported' || status === 'disabled') return false;
    return provider.isConfigured();
  });
}

export function listDescriptors(): ProviderDescriptor[] {
  return ALL_DESCRIPTORS.map((descriptor) => {
    const provider = createProvider(descriptor.key);
    if (!provider) return descriptor;
    if (descriptor.status === 'unsupported') return descriptor;
    return { ...descriptor, status: provider.isConfigured() ? descriptor.status : 'unconfigured' };
  });
}

export { BaseProvider } from './base/base.provider';
export { StubProvider } from './base/stub.provider';
export * from './base/posting.builder';
