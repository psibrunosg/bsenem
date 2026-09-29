import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import packageManifest from '../../package.json' with { type: 'json' };

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const deployScript = readFileSync(resolve(process.cwd(), 'scripts/deploy-vps.sh'), 'utf8');

describe('toolchain manifest', () => {
  it('declares reproducible verification commands', () => {
    expect(packageManifest.type).toBe('module');
    expect(packageManifest.scripts.test).toBe('vitest run');
    expect(packageManifest.scripts['test:backend']).toContain('backend/tests/auth_test.php');
    expect(packageManifest.scripts['test:backend']).toContain('backend/tests/auth_hardening_test.php');
    expect(packageManifest.scripts['test:backend']).toContain('backend/tests/provision_user_test.php');
    expect(packageManifest.scripts['test:backend']).toContain('backend/tests/private_beta_test.php');
    expect(packageManifest.scripts.build).toBe('vite build');
  });

  it('validates nginx configuration before every scripted reload', () => {
    const reloadFunction = deployScript.match(/reload_nginx\(\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(reloadFunction).toContain('nginx -t');
    expect(reloadFunction).toContain('nginx -s reload');
    expect(reloadFunction.indexOf('nginx -t')).toBeLessThan(reloadFunction.indexOf('nginx -s reload'));
  });

  it('declares the standard mobile web app capability meta tag', () => {
    expect(indexHtml).toContain('<meta name="mobile-web-app-capable" content="yes">');
  });

  it('keeps the manifest icon in Vite public assets', () => {
    const manifestPath = resolve(process.cwd(), 'public/manifest.json');
    const iconPath = resolve(process.cwd(), 'public/icon-192.svg');

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(iconPath)).toBe(true);
    expect(JSON.parse(readFileSync(manifestPath, 'utf8')).icons[0].src).toBe('/icon-192.svg');
    expect(readFileSync(iconPath, 'utf8')).toContain('<svg');
  });
});
