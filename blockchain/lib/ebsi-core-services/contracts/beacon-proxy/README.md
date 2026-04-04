# Beacon Proxy

OpenZeppelin-based beacon and beacon proxy contracts with optional versioning and opt-in upgrades.

## Contracts

### Classic (single implementation)

- **UpgradeableBeaconExtended** – Extends OZ `UpgradeableBeacon` with `implementationVersion` and `ImplementationUpgraded(..., newVersion)` event.
- **BeaconProxyExtended** – Extends OZ `BeaconProxy` with `beaconAddress()` and `implementationAddress()` view functions.

### Versioned / opt-in (Safe-like)

Proxies pin a **version** and resolve implementation as `beacon.implementation(version)`. The beacon publishes new versions; each proxy opts in via `upgradeToVersion(newVersion)` (proxy owner only).

- **VersionedUpgradeableBeacon**
  - Stores multiple implementations: `mapping(uint64 => address)` and optional deprecation.
  - **Views**: `latestVersion()`, `implementation(version)`, `isVersionAvailable(version)`, `getVersions()`.
  - **Admin**: `addVersion(version, implementation)` (version must be strictly greater than `latestVersion`), `deprecateVersion(version)`.
  - **Events**: `VersionAdded(version, implementation)`, `VersionDeprecated(version)`.

- **VersionedBeaconProxy**
  - **Storage**: beacon (ERC-1967 slot), pinned `uint64 version`, proxy owner.
  - **Views**: `beacon()`, `version()`, `proxyOwner()`.
  - **Actions**: `upgradeToVersion(newVersion)` (only proxy owner), `transferProxyOwnership(newOwner)`.
  - **Events**: `ProxyUpgraded(oldVersion, newVersion, newImplementation)`, `ProxyOwnerChanged(oldOwner, newOwner)`.

## Versioned flow

1. Beacon admin publishes a new implementation: `beacon.addVersion(v, impl)`.
2. Proxies see `beacon.latestVersion()` and `beacon.implementation(version)`.
3. Proxy owner chooses when to upgrade: `proxy.upgradeToVersion(targetVersion)`.

This allows staged rollouts, per-tenant governance, and adoption only after verification.

## Usage

```solidity
// Deploy versioned beacon with initial implementation (version 1)
VersionedUpgradeableBeacon beacon = new VersionedUpgradeableBeacon(implV1);

// Add versions (beacon owner)
beacon.addVersion(2, implV2);
beacon.addVersion(3, implV3);

// Deploy proxy pinned to version 1, with init data
bytes memory initData = abi.encodeWithSelector(MockImplementation.initialize.selector, "MyName");
VersionedBeaconProxy proxy = new VersionedBeaconProxy(beacon, 1, initData);

// Later: proxy owner opts in to new version
proxy.upgradeToVersion(2);
```

## Tests

- `yarn test` – runs both classic and versioned beacon/proxy tests.
